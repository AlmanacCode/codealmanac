import time

from pydantic import JsonValue

from codealmanac import __version__
from codealmanac.engine.harnesses.models import (
    HarnessEvent,
    HarnessRunResult,
)
from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.integrations.harnesses.codex.errors import CodexAppServerError
from codealmanac.integrations.harnesses.codex.events import (
    CodexRunState,
    done_event,
    map_codex_notification,
    provider_session_event,
)
from codealmanac.integrations.harnesses.codex.fields import (
    JsonObject,
    as_record,
    string_field,
)
from codealmanac.integrations.harnesses.codex.responses import (
    noninteractive_response,
)
from codealmanac.integrations.harnesses.codex.rpc import (
    JsonRpcLineProcess,
    is_server_request,
)
from codealmanac.integrations.harnesses.codex.run_result import (
    failed_result,
    result_from_state,
)
from codealmanac.integrations.harnesses.codex.sandbox import (
    SandboxMode,
    resolve_sandbox_mode,
    sandbox_policy,
)
from codealmanac.integrations.harnesses.codex.timeouts import env_milliseconds
from codealmanac.integrations.harnesses.codex.turn_completion import (
    root_turn_completion,
)

CODEX_APP_SERVER_RPC_TIMEOUT_MS = 30_000
CODEX_APP_SERVER_TURN_TIMEOUT_MS = 30 * 60_000
CODEX_APP_SERVER_RPC_TIMEOUT_ENV = "CODEALMANAC_CODEX_APP_SERVER_RPC_TIMEOUT_MS"
CODEX_APP_SERVER_TURN_TIMEOUT_ENV = "CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS"


class CodexAppServerClient:
    def __init__(
        self,
        command: str = "codex",
        rpc_timeout_seconds: float | None = None,
        turn_timeout_seconds: float | None = None,
        sandbox_mode: SandboxMode | None = None,
    ):
        self.command = command
        self.rpc_timeout_seconds = rpc_timeout_seconds
        self.turn_timeout_seconds = turn_timeout_seconds
        self.sandbox_mode = sandbox_mode

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        try:
            return self._run(request)
        except FileNotFoundError:
            return failed_result("codex not found on PATH")
        except CodexAppServerError as error:
            return failed_result(str(error))

    def _run(self, request: RunHarnessRequest) -> HarnessRunResult:
        state = CodexRunState()
        events: list[HarnessEvent] = []
        rpc_timeout = self.resolved_rpc_timeout_seconds()
        turn_timeout = self.resolved_turn_timeout_seconds()
        sandbox_mode = self.resolved_sandbox_mode()
        process = JsonRpcLineProcess.start(
            self.command,
            ("app-server", "--config", "mcp_servers={}", "--listen", "stdio://"),
            request.cwd,
        )
        try:
            self.request_rpc(
                process,
                "initialize",
                {
                    "clientInfo": {
                        "name": "codealmanac",
                        "title": "CodeAlmanac",
                        "version": __version__,
                    },
                    "capabilities": {"experimentalApi": True},
                },
                rpc_timeout,
                state,
                events,
            )
            thread = as_record(
                self.request_rpc(
                    process,
                    "thread/start",
                    {
                        "cwd": str(request.cwd),
                        "model": None,
                        "approvalPolicy": "never",
                        "sandbox": sandbox_mode,
                        "developerInstructions": None,
                        "ephemeral": True,
                    },
                    rpc_timeout,
                    state,
                    events,
                )
            )
            thread_id = string_field(as_record(thread.get("thread")), "id")
            if thread_id is None:
                raise CodexAppServerError(
                    "Codex app-server thread/start did not return a thread id"
                )
            state.provider_session_id = thread_id
            state.root_thread_id = thread_id
            events.append(provider_session_event(thread_id))
            turn = as_record(
                self.request_rpc(
                    process,
                    "turn/start",
                    {
                        "threadId": thread_id,
                        "cwd": str(request.cwd),
                        "input": [
                            {
                                "type": "text",
                                "text": request.prompt,
                                "text_elements": [],
                            }
                        ],
                        "approvalPolicy": "never",
                        "sandboxPolicy": sandbox_policy(request.cwd, sandbox_mode),
                        "model": None,
                        "effort": None,
                        "outputSchema": None,
                    },
                    rpc_timeout,
                    state,
                    events,
                )
            )
            state.root_turn_id = string_field(as_record(turn.get("turn")), "id")
            return self.read_turn(process, turn_timeout, state, events)
        finally:
            process.terminate()

    def request_rpc(
        self,
        process: "JsonRpcLineProcess",
        method: str,
        params: JsonObject,
        timeout_seconds: float,
        state: CodexRunState,
        events: list[HarnessEvent],
    ) -> JsonValue:
        request_id = process.next_request_id()
        process.write({"id": request_id, "method": method, "params": params})
        deadline = time.monotonic() + timeout_seconds
        while True:
            message = process.read_until(deadline, f"{method} timed out")
            if is_server_request(message):
                self.respond_to_server_request(process, message)
                continue
            if "id" in message:
                if message.get("id") != request_id:
                    continue
                error = as_record(message.get("error"))
                if len(error) > 0:
                    detail = string_field(error, "message") or "request failed"
                    raise CodexAppServerError(f"Codex app-server {method}: {detail}")
                return message.get("result")
            if string_field(message, "method") is not None:
                events.extend(map_codex_notification(message, state))

    def read_turn(
        self,
        process: "JsonRpcLineProcess",
        timeout_seconds: float,
        state: CodexRunState,
        events: list[HarnessEvent],
    ) -> HarnessRunResult:
        deadline = time.monotonic() + timeout_seconds
        while True:
            message = process.read_until(deadline, "turn timed out")
            if is_server_request(message):
                self.respond_to_server_request(process, message)
                continue
            method = string_field(message, "method")
            if method is None:
                continue
            is_root_completion = root_turn_completion(message, state)
            mapped = map_codex_notification(message, state, is_root_completion)
            events.extend(mapped)
            if method == "error":
                return result_from_state(state, events)
            if method == "turn/completed" and is_root_completion:
                events.append(done_event(state))
                return result_from_state(state, events)

    def respond_to_server_request(
        self,
        process: "JsonRpcLineProcess",
        message: JsonObject,
    ) -> None:
        request_id = message.get("id")
        method = string_field(message, "method")
        if request_id is None or method is None:
            return
        response = noninteractive_response(method)
        if response.error is not None:
            process.write({"id": request_id, "error": response.error})
            return
        process.write({"id": request_id, "result": response.result})

    def resolved_rpc_timeout_seconds(self) -> float:
        if self.rpc_timeout_seconds is not None:
            return self.rpc_timeout_seconds
        return (
            env_milliseconds(
                CODEX_APP_SERVER_RPC_TIMEOUT_ENV,
                CODEX_APP_SERVER_RPC_TIMEOUT_MS,
            )
            / 1000
        )

    def resolved_turn_timeout_seconds(self) -> float:
        if self.turn_timeout_seconds is not None:
            return self.turn_timeout_seconds
        return (
            env_milliseconds(
                CODEX_APP_SERVER_TURN_TIMEOUT_ENV,
                CODEX_APP_SERVER_TURN_TIMEOUT_MS,
            )
            / 1000
        )

    def resolved_sandbox_mode(self) -> SandboxMode:
        return resolve_sandbox_mode(self.sandbox_mode)

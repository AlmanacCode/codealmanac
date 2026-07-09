import threading
from pathlib import Path

import httpx

from codealmanac.core.paths import home_dir
from codealmanac.integrations.harnesses.fields import (
    JsonObject,
    as_record,
    string_field,
)
from codealmanac.integrations.harnesses.opencode.http import (
    create_session,
    get_providers,
    post_message,
)
from codealmanac.integrations.harnesses.opencode.model_ref import split_opencode_model
from codealmanac.integrations.harnesses.opencode.parts import final_text_from_parts
from codealmanac.integrations.harnesses.opencode.progress import (
    OPENCODE_POLL_INTERVAL_SECONDS,
    OPENCODE_STUCK_TOOL_CALL_SECONDS,
    OpencodeProgressWatchdog,
    OpencodeStuckToolCallError,
)
from codealmanac.integrations.harnesses.opencode.result import (
    done_event,
    failed_result,
    provider_session_event,
    result_from_state,
)
from codealmanac.integrations.harnesses.opencode.server import (
    OpencodeServerStartupError,
    start_opencode_server,
)
from codealmanac.integrations.harnesses.opencode.state import OpencodeRunState
from codealmanac.integrations.harnesses.opencode.timeouts import env_seconds
from codealmanac.integrations.harnesses.opencode.usage import parse_opencode_usage
from codealmanac.integrations.harnesses.stream import (
    append_event,
    emit_result,
)
from codealmanac.integrations.opencode_paths import OPENCODE_DB_RELATIVE_PATH
from codealmanac.services.harnesses.actors import (
    HarnessActorConfidence,
    HarnessActorRole,
)
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessKind,
    HarnessReadiness,
    HarnessRunActor,
    HarnessRunResult,
)
from codealmanac.services.harnesses.ports import HarnessEventSink
from codealmanac.services.harnesses.requests import RunHarnessRequest

OPENCODE_COMMAND = "opencode"
OPENCODE_CHECK_STARTUP_TIMEOUT_SECONDS = 5.0
OPENCODE_CHECK_REQUEST_TIMEOUT_SECONDS = 5.0
OPENCODE_RUN_STARTUP_TIMEOUT_SECONDS = 10.0
OPENCODE_RUN_REQUEST_TIMEOUT_SECONDS = 900.0
OPENCODE_NOT_INSTALLED_MESSAGE = "opencode not found on PATH"
OPENCODE_SERVER_REPAIR = "run `opencode serve` directly to check for a startup error"
OPENCODE_PROVIDER_REPAIR = (
    "sign in with `opencode auth login` or configure a provider API key"
)
OPENCODE_POLL_INTERVAL_ENV = "CODEALMANAC_OPENCODE_POLL_INTERVAL_SECONDS"
OPENCODE_STUCK_TOOL_CALL_ENV = "CODEALMANAC_OPENCODE_STUCK_TOOL_CALL_SECONDS"
# How long the watchdog waits for the sender thread to notice a detected
# hang before the main loop's own join() check fires — short because we
# just need to react to watchdog.stuck_reason promptly, not wait it out.
OPENCODE_STUCK_CHECK_INTERVAL_SECONDS = 1.0


class OpencodeClient:
    def __init__(
        self,
        command: str = OPENCODE_COMMAND,
        check_startup_timeout_seconds: float = OPENCODE_CHECK_STARTUP_TIMEOUT_SECONDS,
        check_request_timeout_seconds: float = OPENCODE_CHECK_REQUEST_TIMEOUT_SECONDS,
        run_startup_timeout_seconds: float = OPENCODE_RUN_STARTUP_TIMEOUT_SECONDS,
        run_request_timeout_seconds: float = OPENCODE_RUN_REQUEST_TIMEOUT_SECONDS,
        db_path: Path | None = None,
        poll_interval_seconds: float | None = None,
        stuck_after_seconds: float | None = None,
    ):
        self.command = command
        self.check_startup_timeout_seconds = check_startup_timeout_seconds
        self.check_request_timeout_seconds = check_request_timeout_seconds
        self.run_startup_timeout_seconds = run_startup_timeout_seconds
        self.run_request_timeout_seconds = run_request_timeout_seconds
        self.db_path = db_path or home_dir() / OPENCODE_DB_RELATIVE_PATH
        self.poll_interval_seconds = poll_interval_seconds or env_seconds(
            OPENCODE_POLL_INTERVAL_ENV, OPENCODE_POLL_INTERVAL_SECONDS
        )
        self.stuck_after_seconds = stuck_after_seconds or env_seconds(
            OPENCODE_STUCK_TOOL_CALL_ENV, OPENCODE_STUCK_TOOL_CALL_SECONDS
        )

    def check_providers(self, cwd: Path) -> HarnessReadiness:
        try:
            with start_opencode_server(
                self.command, cwd, self.check_startup_timeout_seconds
            ) as server:
                providers = get_providers(
                    server.base_url, self.check_request_timeout_seconds
                )
        except FileNotFoundError:
            return HarnessReadiness(
                kind=HarnessKind.OPENCODE,
                available=False,
                message=OPENCODE_NOT_INSTALLED_MESSAGE,
            )
        except OpencodeServerStartupError as error:
            return HarnessReadiness(
                kind=HarnessKind.OPENCODE,
                available=False,
                message=str(error),
                repair=OPENCODE_SERVER_REPAIR,
            )
        except httpx.HTTPError as error:
            return HarnessReadiness(
                kind=HarnessKind.OPENCODE,
                available=False,
                message=f"opencode server request failed: {error}",
                repair=OPENCODE_SERVER_REPAIR,
            )
        except ValueError as error:
            # response.json() raises json.JSONDecodeError (a ValueError) on a
            # malformed 200 body; mirrors the same except arm in run_once().
            return HarnessReadiness(
                kind=HarnessKind.OPENCODE,
                available=False,
                message=f"opencode server returned an invalid response: {error}",
                repair=OPENCODE_SERVER_REPAIR,
            )
        if len(providers) == 0:
            return HarnessReadiness(
                kind=HarnessKind.OPENCODE,
                available=False,
                message="no opencode providers are configured",
                repair=OPENCODE_PROVIDER_REPAIR,
            )
        names = ", ".join(provider_label(provider) for provider in providers)
        return HarnessReadiness(
            kind=HarnessKind.OPENCODE,
            available=True,
            message=f"opencode providers configured: {names}",
        )

    def run(
        self,
        request: RunHarnessRequest,
        on_event: HarnessEventSink | None = None,
    ) -> HarnessRunResult:
        # Mirrors check_providers()'s except chain above (same failure modes,
        # different return shape) — keep the two in sync if either changes.
        try:
            return self.run_once(request, on_event)
        except FileNotFoundError:
            return emit_result(failed_result(OPENCODE_NOT_INSTALLED_MESSAGE), on_event)
        except OpencodeServerStartupError as error:
            return emit_result(failed_result(str(error)), on_event)
        except OpencodeStuckToolCallError as error:
            return emit_result(failed_result(str(error)), on_event)
        except httpx.HTTPError as error:
            return emit_result(
                failed_result(f"opencode server request failed: {error}"), on_event
            )
        except ValueError as error:
            return emit_result(failed_result(str(error)), on_event)

    def run_once(
        self,
        request: RunHarnessRequest,
        on_event: HarnessEventSink | None,
    ) -> HarnessRunResult:
        provider_id, model_id = split_opencode_model(request.model)
        state = OpencodeRunState()
        events: list[HarnessEvent] = []
        with start_opencode_server(
            self.command, request.cwd, self.run_startup_timeout_seconds
        ) as server:
            session = create_session(
                server.base_url,
                str(request.cwd),
                request.title or "codealmanac run",
                self.run_request_timeout_seconds,
            )
            session_id = string_field(session, "id")
            if session_id is None:
                raise OpencodeServerStartupError(
                    "opencode did not return a session id"
                )
            state.provider_session_id = session_id
            append_event(events, provider_session_event(session_id), on_event)

            actor = HarnessRunActor(
                thread_id=session_id,
                role=HarnessActorRole.ROOT,
                confidence=HarnessActorConfidence.PROVIDER,
                label="Main",
            )

            # Watchdog owns all live event emission for this session tree —
            # both the "narrate progress" and "detect a hung tool call"
            # goals share one poller. See progress.py and the
            # 2026-07-09-opencode-harness-live-progress-and-hang-detection
            # plan doc.
            watchdog = OpencodeProgressWatchdog(
                db_path=self.db_path,
                root_session_id=session_id,
                root_actor=actor,
                state=state,
                events=events,
                on_event=on_event,
                poll_interval_seconds=self.poll_interval_seconds,
                stuck_after_seconds=self.stuck_after_seconds,
            )
            stop_event = threading.Event()
            watchdog_thread = threading.Thread(
                target=watchdog.run, args=(stop_event,), daemon=True
            )
            watchdog_thread.start()

            message_result: dict[str, JsonObject | Exception] = {}

            def _send() -> None:
                try:
                    message_result["response"] = post_message(
                        server.base_url,
                        session_id,
                        str(request.cwd),
                        provider_id,
                        model_id,
                        request.prompt,
                        self.run_request_timeout_seconds,
                    )
                except Exception as error:  # noqa: BLE001 - surfaced below
                    message_result["error"] = error

            sender_thread = threading.Thread(target=_send, daemon=True)
            sender_thread.start()

            while sender_thread.is_alive():
                if watchdog.stuck_reason is not None:
                    # Unwinds through `with start_opencode_server(...)`,
                    # which terminates the server — killing the connection
                    # the sender thread is blocked on, so it errors out and
                    # dies (daemon; its error is discarded, ours is
                    # authoritative). No cross-thread cancellation needed.
                    raise OpencodeStuckToolCallError(watchdog.stuck_reason)
                sender_thread.join(timeout=OPENCODE_STUCK_CHECK_INTERVAL_SECONDS)
            # Loop exited because the sender thread finished, not because we
            # raised above — deliberately no second stuck_reason check here.
            # If post_message already produced a real result, that outcome
            # wins over a heuristic that fired a beat too late; don't "fix"
            # this into a race by adding one.
            stop_event.set()
            # A generous but bounded join: the watchdog is a daemon thread,
            # so it can't block process exit either way. If this join times
            # out mid-poll, a very-late event could in principle still land
            # in `events`/on_event after the tuple(events) snapshot below is
            # taken (append is GIL-atomic, so no crash/corruption) — low
            # consequence since real callers persist events live via
            # on_event, not by re-reading the returned result.events.
            watchdog_thread.join(timeout=self.poll_interval_seconds * 2 + 5)

            if "error" in message_result:
                raise message_result["error"]
            response = message_result["response"]
            info = as_record(response.get("info"))
            raw_parts = response.get("parts")
            parts = (
                [as_record(part) for part in raw_parts]
                if isinstance(raw_parts, list)
                else []
            )
            text = final_text_from_parts(parts)
            if text is not None:
                state.result = text
                state.result_source_thread_id = session_id
                state.result_source_role = HarnessActorRole.ROOT
            state.usage = parse_opencode_usage(info.get("tokens"))
            state.success = True

        append_event(events, done_event(state), on_event)
        return result_from_state(state, events)


def provider_label(provider: JsonObject) -> str:
    return string_field(provider, "name") or string_field(provider, "id") or "provider"

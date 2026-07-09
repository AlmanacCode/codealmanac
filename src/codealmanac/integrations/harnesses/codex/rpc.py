import json
import os
import queue
import signal
import subprocess
import threading
import time
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from pydantic import JsonValue, TypeAdapter, ValidationError

from codealmanac.integrations.harnesses.codex.errors import CodexAppServerError
from codealmanac.integrations.harnesses.fields import (
    JsonObject,
    as_record,
    string_field,
)

JSON_VALUE = TypeAdapter(JsonValue)


class JsonRpcLineProcess:
    def __init__(self, child: subprocess.Popen[str]):
        self.child = child
        self.messages: queue.Queue[JsonObject | ProcessStreamClosed] = queue.Queue()
        self.stderr_chunks: list[str] = []
        self._next_request_id = 1
        self.start_reader_threads()

    @classmethod
    def start(
        cls,
        command: str,
        args: tuple[str, ...],
        cwd: Path,
    ) -> "JsonRpcLineProcess":
        child = subprocess.Popen(
            (command, *args),
            cwd=cwd,
            env={**os.environ, "CODEALMANAC_INTERNAL_SESSION": "1"},
            text=True,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=1,
            start_new_session=True,
        )
        return cls(child)

    def next_request_id(self) -> int:
        value = self._next_request_id
        self._next_request_id += 1
        return value

    def write(self, message: Mapping[str, JsonValue]) -> None:
        if self.child.stdin is None:
            raise CodexAppServerError("Codex app-server stdin is closed")
        self.child.stdin.write(f"{json.dumps(message)}\n")
        self.child.stdin.flush()

    def read_until(self, deadline: float, timeout_label: str) -> JsonObject:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise CodexAppServerError(f"Codex app-server {timeout_label}")
            if self.child.poll() is not None and self.messages.empty():
                raise CodexAppServerError(self.exit_message())
            try:
                item = self.messages.get(timeout=min(remaining, 0.1))
            except queue.Empty:
                continue
            if isinstance(item, ProcessStreamClosed):
                if self.child.poll() is not None:
                    raise CodexAppServerError(self.exit_message())
                continue
            return item

    def terminate(self) -> None:
        if self.child.poll() is not None:
            return
        try:
            os.killpg(os.getpgid(self.child.pid), signal.SIGTERM)
        except (AttributeError, ProcessLookupError, PermissionError, OSError):
            self.child.terminate()
        try:
            self.child.wait(timeout=0.5)
            return
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(os.getpgid(self.child.pid), signal.SIGKILL)
        except (AttributeError, ProcessLookupError, PermissionError, OSError):
            self.child.kill()
        with suppress_timeout():
            self.child.wait(timeout=0.5)

    def exit_message(self) -> str:
        stderr = "".join(self.stderr_chunks).strip()
        first_stderr = stderr.splitlines()[0] if stderr else ""
        if first_stderr:
            return first_stderr
        return f"codex app-server exited {self.child.returncode or 1}"

    def start_reader_threads(self) -> None:
        threading.Thread(target=self.read_stdout, daemon=True).start()
        threading.Thread(target=self.read_stderr, daemon=True).start()

    def read_stdout(self) -> None:
        try:
            if self.child.stdout is None:
                return
            for line in self.child.stdout:
                message = parse_json_line(line)
                if message is not None:
                    self.messages.put(message)
        finally:
            self.messages.put(ProcessStreamClosed())

    def read_stderr(self) -> None:
        if self.child.stderr is None:
            return
        for chunk in self.child.stderr:
            self.stderr_chunks.append(chunk)


@dataclass(frozen=True)
class ProcessStreamClosed:
    pass


def parse_json_line(line: str) -> JsonObject | None:
    stripped = line.strip()
    if stripped == "":
        return None
    try:
        parsed = JSON_VALUE.validate_python(json.loads(stripped))
    except (json.JSONDecodeError, ValidationError, ValueError):
        return None
    record = as_record(parsed)
    return record or None


def is_server_request(message: JsonObject) -> bool:
    return "id" in message and string_field(message, "method") is not None


class suppress_timeout:
    def __enter__(self) -> None:
        return None

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> bool:
        return isinstance(exc, subprocess.TimeoutExpired)

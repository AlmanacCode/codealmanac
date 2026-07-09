import json
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from codealmanac.database import query_readonly_or_empty
from codealmanac.integrations.harnesses.fields import (
    JsonObject,
    as_record,
    number_field,
    string_field,
    stringify_json_value,
)
from codealmanac.integrations.harnesses.opencode.parts import (
    is_task_settled,
    is_task_spawn,
    map_opencode_part,
)
from codealmanac.integrations.harnesses.opencode.state import OpencodeRunState
from codealmanac.services.harnesses.actors import (
    HarnessActorConfidence,
    HarnessActorRole,
)
from codealmanac.services.harnesses.models import (
    HarnessAgentTrace,
    HarnessEvent,
    HarnessEventKind,
    HarnessRunActor,
    HarnessToolStatus,
)
from codealmanac.services.harnesses.ports import HarnessEventSink

# Joins message to filter to assistant-authored parts only — part rows
# alone don't carry role, and a session's own part table includes the
# user's/prompt's echoed-back input parts too (confirmed by a live smoke
# test: without this filter, the prompt itself showed up as a spurious
# TEXT event). The synchronous POST response never had this problem
# because it only ever returns the new assistant message's parts; polling
# the whole session table needs to filter for the same thing explicitly.
_PARTS_QUERY = """
SELECT part.id AS id, part.data AS part_data, message.data AS message_data
FROM part
JOIN message ON message.id = part.message_id
WHERE part.session_id = ?
ORDER BY part.time_created
"""

OPENCODE_POLL_INTERVAL_SECONDS = 2.0
OPENCODE_STUCK_TOOL_CALL_SECONDS = 240.0
# Upstream tracking issue confirmed live (WebSearch, 2026-07-09) — OpenCode's
# tool-execution layer has no internal timeout, so a glob/read/bash call can
# hang forever regardless of model. Not fixable from this adapter, only
# detectable — see the 2026-07-09-opencode-harness-live-progress-and-hang-
# detection plan doc.
OPENCODE_STUCK_TOOL_CALL_ISSUE_URL = "github.com/anomalyco/opencode/issues/33541"


@dataclass
class OpencodeStuckToolCall:
    tool_name: str
    session_id: str
    elapsed_seconds: float
    tool_input: str | None = None


class OpencodeStuckToolCallError(Exception):
    def __init__(self, info: OpencodeStuckToolCall):
        self.info = info
        super().__init__(
            f'OpenCode\'s "{info.tool_name}" tool call has been stuck for '
            f"{int(info.elapsed_seconds)}s+ with no response (session "
            f"{info.session_id}) — this is a known upstream OpenCode "
            f"reliability issue ({OPENCODE_STUCK_TOOL_CALL_ISSUE_URL}), not "
            "specific to this run."
        )


class OpencodeProgressWatchdog:
    """Polls OpenCode's own SQLite db while a run is in flight: emits live
    HarnessEvents for new parts across the root session and any sub-agent
    sessions it discovers, and detects a tool call stuck past a threshold.

    Reuses the read-only querying built for transcript reading (Slice 3),
    not the HTTP API — proven reliable in this codebase; OpenCode's SSE
    stream was spiked and found unreliable for this exact purpose (see the
    plan doc's "Why polling the DB, not retrying SSE").

    "Live" only covers terminal parts: a tool call still status: "running"
    produces no TOOL_USE narration yet (map_opencode_part isn't called
    until it settles — see _poll_session) — it only feeds _check_stuck.
    You won't see "reading file X" while it happens, only once it's done
    (or once it's been flagged stuck). Confirmed against the plan doc's
    live-verification timestamps, which cluster right after each tool call
    completes, not at call-start.
    """

    def __init__(
        self,
        db_path: Path,
        root_session_id: str,
        root_actor: HarnessRunActor,
        state: OpencodeRunState,
        events: list[HarnessEvent],
        on_event: HarnessEventSink | None,
        poll_interval_seconds: float = OPENCODE_POLL_INTERVAL_SECONDS,
        stuck_after_seconds: float = OPENCODE_STUCK_TOOL_CALL_SECONDS,
    ):
        self.db_path = db_path
        self.state = state
        self.events = events
        self.on_event = on_event
        self.poll_interval_seconds = poll_interval_seconds
        self.stuck_after_seconds = stuck_after_seconds

        self._known_sessions: set[str] = {root_session_id}
        self._actors: dict[str, HarnessRunActor] = {root_session_id: root_actor}
        self._seen_part_ids: set[str] = set()
        self._spawned_part_ids: set[str] = set()
        self.stuck_reason: OpencodeStuckToolCall | None = None

    def run(self, stop_event: threading.Event) -> None:
        while not stop_event.is_set():
            self._poll_once()
            if self.stuck_reason is not None:
                return
            stop_event.wait(self.poll_interval_seconds)
        # One final pass: the DB is fully written by the time the caller
        # sets stop_event (only done after the blocking POST returns), so
        # this picks up anything the last timed poll cycle missed.
        self._poll_once()

    def _poll_once(self) -> None:
        # Snapshot: polling one session can discover new ones mid-loop.
        for session_id in tuple(self._known_sessions):
            self._poll_session(session_id)
            if self.stuck_reason is not None:
                return

    def _poll_session(self, session_id: str) -> None:
        actor = self._actors.get(session_id)
        if actor is None:
            return
        rows = query_readonly_or_empty(self.db_path, _PARTS_QUERY, (session_id,))
        now_ms = int(time.time() * 1000)
        for row in rows:
            part_id = row["id"]
            if part_id in self._seen_part_ids:
                continue
            part = _parse_part(row["part_data"])
            if part is None:
                continue
            message = _parse_part(row["message_data"])
            if message is not None and string_field(message, "role") != "assistant":
                # The user's/prompt's own part, echoed back on the same
                # session — not model output, don't map or stuck-check it.
                self._seen_part_ids.add(part_id)
                continue

            spawn = is_task_spawn(part)
            if spawn is not None and part_id not in self._spawned_part_ids:
                self._spawned_part_ids.add(part_id)
                self._handle_spawn(session_id, spawn)

            if string_field(part, "type") == "tool":
                state = as_record(part.get("state"))
                if string_field(state, "status") == "running":
                    self._check_stuck(session_id, part, state, now_ms)
                    if self.stuck_reason is not None:
                        return
                    continue  # not terminal yet — re-check next poll
                settled = is_task_settled(part)
                if settled is not None:
                    self._handle_settle(part, settled)

            self._seen_part_ids.add(part_id)
            for mapped in map_opencode_part(part, actor):
                self._emit(mapped)

    def _check_stuck(
        self,
        session_id: str,
        part: JsonObject,
        state: JsonObject,
        now_ms: int,
    ) -> None:
        time_info = as_record(state.get("time"))
        start_ms = number_field(time_info, "start")
        if start_ms is None:
            return
        elapsed_seconds = (now_ms - start_ms) / 1000
        if elapsed_seconds >= self.stuck_after_seconds:
            self.stuck_reason = OpencodeStuckToolCall(
                tool_name=string_field(part, "tool") or "tool",
                session_id=session_id,
                elapsed_seconds=elapsed_seconds,
                tool_input=stringify_json_value(state.get("input")),
            )

    def _handle_spawn(self, parent_session_id: str, spawn: tuple[str, str]) -> None:
        child_session_id, prompt = spawn
        if child_session_id in self._known_sessions:
            return
        self._known_sessions.add(child_session_id)
        self.state.agent_parents[child_session_id] = parent_session_id
        label = f"Helper {len(self.state.agent_labels) + 1}"
        self.state.agent_labels[child_session_id] = label
        child_actor = HarnessRunActor(
            thread_id=child_session_id,
            role=HarnessActorRole.HELPER,
            parent_thread_id=parent_session_id,
            confidence=HarnessActorConfidence.DERIVED,
            label=label,
        )
        self._actors[child_session_id] = child_actor
        self._emit(
            HarnessEvent(
                kind=HarnessEventKind.AGENT_SPAWNED,
                message=f"spawned {label}",
                actor=self._actors.get(parent_session_id),
                agent_trace=HarnessAgentTrace(
                    parent_thread_id=parent_session_id,
                    child_thread_id=child_session_id,
                    prompt=prompt or None,
                ),
            )
        )

    def _handle_settle(
        self,
        part: JsonObject,
        settled_status: HarnessToolStatus,
    ) -> None:
        state = as_record(part.get("state"))
        metadata = as_record(state.get("metadata"))
        child_session_id = string_field(metadata, "sessionId")
        if child_session_id is None:
            return
        child_actor = self._actors.get(child_session_id)
        if child_actor is None:
            return
        label = self.state.agent_labels.get(child_session_id, "helper")
        if settled_status == HarnessToolStatus.FAILED:
            self._emit(
                HarnessEvent(
                    kind=HarnessEventKind.ERROR,
                    message=f"{label} failed",
                    actor=child_actor,
                )
            )
            return
        self._emit(
            HarnessEvent(
                kind=HarnessEventKind.AGENT_COMPLETED,
                message=f"{label} completed",
                actor=child_actor,
                agent_trace=HarnessAgentTrace(
                    parent_thread_id=self.state.agent_parents.get(child_session_id),
                    child_thread_id=child_session_id,
                    result=string_field(state, "output"),
                ),
            )
        )

    def _emit(self, event: HarnessEvent) -> None:
        self.events.append(event)
        if self.on_event is not None:
            self.on_event(event)


def _parse_part(value: object) -> JsonObject | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = json.loads(value)
    except ValueError:
        return None
    return parsed if isinstance(parsed, dict) else None

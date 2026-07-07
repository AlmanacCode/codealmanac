import time
from collections.abc import Iterator

from codealmanac.services.runs.models import (
    RunAttachUpdate,
    RunEventKind,
    RunLogEvent,
    RunStatus,
)
from codealmanac.services.runs.store import RunStore

TERMINAL_SETTLE_POLLS = 1


class RunAttachStreamer:
    def __init__(self, store: RunStore):
        self.store = store

    def stream(
        self,
        run_id: str,
        poll_interval_seconds: float,
    ) -> Iterator[RunAttachUpdate]:
        last_sequence = 0
        terminal_settle_polls = TERMINAL_SETTLE_POLLS
        while True:
            snapshot = self.store.attach(run_id)
            if (
                snapshot.terminal
                and terminal_settle_polls > 0
                and not terminal_status_event_seen(
                    snapshot.events,
                    snapshot.record.status,
                )
            ):
                terminal_settle_polls -= 1
                time.sleep(poll_interval_seconds)
                continue
            events = events_after(snapshot.events, last_sequence)
            if len(events) > 0:
                last_sequence = max(event.sequence for event in events)
            if len(events) > 0 or snapshot.terminal:
                yield RunAttachUpdate(
                    record=snapshot.record,
                    events=events,
                    terminal=snapshot.terminal,
                )
            if snapshot.terminal:
                return
            time.sleep(poll_interval_seconds)


def events_after(
    events: tuple[RunLogEvent, ...],
    last_sequence: int,
) -> tuple[RunLogEvent, ...]:
    return tuple(event for event in events if event.sequence > last_sequence)


def terminal_status_event_seen(
    events: tuple[RunLogEvent, ...],
    status: RunStatus,
) -> bool:
    return any(
        event.kind == RunEventKind.STATUS and event.message == status.value
        for event in events
    )

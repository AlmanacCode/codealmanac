import time
from collections.abc import Iterator
from pathlib import Path

from codealmanac.jobs.ledger.models import (
    JobAttachUpdate,
    JobEventKind,
    JobLogEvent,
    JobStatus,
)
from codealmanac.jobs.ledger.store import JobStore

TERMINAL_SETTLE_SECONDS = 1.0


class JobAttachStreamer:
    def __init__(
        self,
        store: JobStore,
        terminal_settle_seconds: float = TERMINAL_SETTLE_SECONDS,
    ):
        if terminal_settle_seconds < 0:
            raise ValueError("terminal settle seconds must be non-negative")
        self.store = store
        self.terminal_settle_seconds = terminal_settle_seconds

    def stream(
        self,
        almanac_path: Path,
        job_id: str,
        poll_interval_seconds: float,
    ) -> Iterator[JobAttachUpdate]:
        last_sequence = 0
        terminal_seen_at: float | None = None
        while True:
            snapshot = self.store.attach(almanac_path, job_id)
            if snapshot.terminal and not terminal_status_event_seen(
                snapshot.events,
                snapshot.record.status,
            ):
                now = time.monotonic()
                if terminal_seen_at is None:
                    terminal_seen_at = now
                if now - terminal_seen_at < self.terminal_settle_seconds:
                    time.sleep(poll_interval_seconds)
                    continue
            else:
                terminal_seen_at = None
            events = events_after(snapshot.events, last_sequence)
            if len(events) > 0:
                last_sequence = max(event.sequence for event in events)
            if len(events) > 0 or snapshot.terminal:
                yield JobAttachUpdate(
                    record=snapshot.record,
                    events=events,
                    terminal=snapshot.terminal,
                )
            if snapshot.terminal:
                return
            time.sleep(poll_interval_seconds)


def events_after(
    events: tuple[JobLogEvent, ...],
    last_sequence: int,
) -> tuple[JobLogEvent, ...]:
    return tuple(event for event in events if event.sequence > last_sequence)


def terminal_status_event_seen(
    events: tuple[JobLogEvent, ...],
    status: JobStatus,
) -> bool:
    return any(
        event.kind == JobEventKind.STATUS and event.message == status.value
        for event in events
    )

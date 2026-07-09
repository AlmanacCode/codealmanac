from codealmanac.services.harnesses.models import HarnessEvent, HarnessRunResult
from codealmanac.services.harnesses.ports import HarnessEventSink


def append_event(
    events: list[HarnessEvent],
    event: HarnessEvent,
    on_event: HarnessEventSink | None,
) -> None:
    events.append(event)
    if on_event is not None:
        on_event(event)


def append_events(
    events: list[HarnessEvent],
    new_events: tuple[HarnessEvent, ...],
    on_event: HarnessEventSink | None,
) -> None:
    for event in new_events:
        append_event(events, event, on_event)


def emit_result(
    result: HarnessRunResult,
    on_event: HarnessEventSink | None,
) -> HarnessRunResult:
    if on_event is not None:
        for event in result.events:
            on_event(event)
    return result

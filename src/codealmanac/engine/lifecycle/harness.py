from codealmanac.core.errors import ExecutionFailed
from codealmanac.engine.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessRunResult,
    HarnessRunStatus,
    terminal_harness_event,
)
from codealmanac.jobs.ledger.models import JobEventKind


def validate_harness_result(result: HarnessRunResult) -> None:
    if result.status != HarnessRunStatus.SUCCEEDED:
        suffix = first_line(result.output_text)
        details = f": {suffix}" if suffix else ""
        raise ExecutionFailed(
            f"harness {result.kind.value} failed with status "
            f"{result.status.value}{details}"
        )


def harness_events(result: HarnessRunResult) -> tuple[HarnessEvent, ...]:
    if len(result.events) > 0:
        return result.events
    return (terminal_harness_event(result.kind, result.status, result.output_text),)


def harness_run_event_kind(event: HarnessEvent) -> JobEventKind:
    if event.kind == HarnessEventKind.ERROR:
        return JobEventKind.ERROR
    if event.kind in {
        HarnessEventKind.TOOL_USE,
        HarnessEventKind.TOOL_RESULT,
        HarnessEventKind.TOOL_SUMMARY,
        HarnessEventKind.CONTEXT_USAGE,
        HarnessEventKind.PROVIDER_SESSION,
        HarnessEventKind.WARNING,
        HarnessEventKind.AGENT_SPAWNED,
        HarnessEventKind.AGENT_WAIT_STARTED,
        HarnessEventKind.AGENT_COMPLETED,
    }:
        return JobEventKind.TOOL
    return JobEventKind.OUTPUT


def first_line(value: str) -> str:
    return value.splitlines()[0] if value.splitlines() else value

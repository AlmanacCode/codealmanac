from __future__ import annotations

from yoke import Failure, Run, RunStatus

from codealmanac.integrations.harnesses.yoke.events import YokeEventProjector
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessFailure,
    HarnessKind,
    HarnessRunResult,
    HarnessRunStatus,
    HarnessTranscriptRef,
)


def project_run(
    run: Run,
    kind: HarnessKind,
    projector: YokeEventProjector,
    events: tuple[HarnessEvent, ...] = (),
) -> HarnessRunResult:
    projected = list(events)
    if not projected:
        for event in run.events:
            projected.extend(projector.project(event))
    status = HarnessRunStatus(str(run.status))
    failure = project_failure(run.failure, kind)
    ensure_terminal_event(projected, kind, status, output_text(run), failure)
    return HarnessRunResult(
        kind=kind,
        status=status,
        output_text=output_text(run),
        transcript=(
            HarnessTranscriptRef(kind=kind, session_id=run.provider_session_id)
            if run.provider_session_id
            else None
        ),
        events=tuple(projected),
    )


def output_text(run: Run) -> str:
    if run.output and run.output.strip():
        return run.output.strip()
    if run.failure is not None:
        return run.failure.message
    if run.status is RunStatus.CANCELLED:
        return f"{run.provider} cancelled"
    return f"{run.provider} completed"


def project_failure(
    failure: Failure | None,
    kind: HarnessKind,
) -> HarnessFailure | None:
    if failure is None:
        return None
    return HarnessFailure(
        provider=kind,
        message=failure.message,
        fix=failure.fix,
        code=failure.code,
        raw=failure.raw,
    )


def ensure_terminal_event(
    events: list[HarnessEvent],
    kind: HarnessKind,
    status: HarnessRunStatus,
    output: str,
    failure: HarnessFailure | None,
) -> None:
    terminals = [
        (index, event)
        for index, event in enumerate(events)
        if event.kind is HarnessEventKind.DONE
    ]
    terminal = terminals[-1][1] if terminals else None
    if terminal is None:
        events.append(
            HarnessEvent(
                kind=HarnessEventKind.DONE,
                status=status,
                message=f"{kind.value} {status.value}: {output.splitlines()[0]}",
                failure=failure,
            )
        )
        return
    events[:] = [event for event in events if event.kind is not HarnessEventKind.DONE]
    events.append(terminal.model_copy(
        update={"status": status, "failure": failure}
    ))

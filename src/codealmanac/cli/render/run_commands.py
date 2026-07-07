import json

from codealmanac.cli.render.style import style
from codealmanac.services.runs.models import RunKind
from codealmanac.workflows.run_queue.models import (
    RunQueueStartResult,
    ScheduledGardenResult,
)

RUN_QUIPS = {
    RunKind.BUILD: "every codebase deserves a biography — writing yours now.",
    RunKind.INGEST: "the wiki is hungry — feeding it your latest work.",
    RunKind.GARDEN: "weeding, pruning, watering. your wiki, but tidier.",
}


def render_run_queue_start(
    result: RunQueueStartResult,
    json_output: bool,
) -> None:
    if json_output:
        print(
            json.dumps(
                {
                    "run_id": result.run.run_id,
                    "repository": result.repository.name,
                    "runs_ahead": result.runs_ahead,
                    "status": result.run.status.value,
                    "child_pid": result.worker.child_pid,
                },
                indent=2,
            )
        )
        return
    render_run_queue_started(result)


def render_run_queue_started(result: RunQueueStartResult) -> None:
    record = result.run
    blue = style.BLUE
    dim = style.DIM
    bold = style.BOLD
    rst = style.RST
    print(f"{blue}◆{rst} {record.kind.value} queued: {blue}{record.run_id}{rst}")
    print(f"{dim}│{rst} repo:    {result.repository.name}")
    print(f"{dim}│{rst} ahead:   {result.runs_ahead} run(s)")
    print(f"{dim}│{rst} follow:  {bold}codealmanac jobs attach {record.run_id}{rst}")
    print(f"{dim}│{rst} details: {bold}codealmanac jobs show {record.run_id}{rst}")
    print(f"{dim}│ worker: pid {result.worker.child_pid}{rst}")
    quip = RUN_QUIPS.get(record.kind)
    if quip is not None:
        print(f"{dim}◇ {quip}{rst}")


def render_scheduled_garden(result: ScheduledGardenResult) -> None:
    print(f"scheduled garden: {len(result.runs)} queued, {len(result.skipped)} skipped")
    for run in result.runs:
        print(f"  - {run.kind.value} {run.run_id}")
    for repository in result.skipped:
        print(f"  - skipped {repository.name}: garden already queued or running")
    if result.worker is not None:
        print(f"worker: pid {result.worker.child_pid}")
    if result.worker_error is not None:
        print(f"  ! worker spawn failed: {result.worker_error}")

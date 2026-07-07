import json
from pathlib import Path

from codealmanac.cli.render.common import index_summary
from codealmanac.cli.render.style import style
from codealmanac.services.index.models import HealthReport
from codealmanac.services.runs.models import RunKind, RunRecord
from codealmanac.workflows.build.models import BuildResult
from codealmanac.workflows.garden.models import GardenResult
from codealmanac.workflows.ingest.models import IngestResult
from codealmanac.workflows.run_queue.models import (
    RunQueueStartResult,
    ScheduledGardenResult,
)

RUN_QUIPS = {
    RunKind.BUILD: "every codebase deserves a biography — writing yours now.",
    RunKind.INGEST: "the wiki is hungry — feeding it your latest work.",
    RunKind.GARDEN: "weeding, pruning, watering. your wiki, but tidier.",
}


def render_run_started(
    record: RunRecord,
    label: str | None = None,
    worker_pid: int | None = None,
) -> None:
    blue = style.BLUE
    dim = style.DIM
    bold = style.BOLD
    rst = style.RST
    name = label or record.kind.value
    print(f"{blue}◆{rst} {name} started: {blue}{record.run_id}{rst}")
    where = "in a worker" if worker_pid is not None else "in this terminal"
    print(f"{dim}│{rst} the agent is working {where} — this can take a few minutes.")
    print(f"{dim}│{rst} track:   {bold}codealmanac jobs attach {record.run_id}{rst}")
    print(f"{dim}│{rst} details: {bold}codealmanac jobs show {record.run_id}{rst}")
    if worker_pid is not None:
        print(f"{dim}│ worker: pid {worker_pid}{rst}")
    quip = RUN_QUIPS.get(record.kind)
    if quip is not None:
        print(f"{dim}◇ {quip}{rst}")


def render_run_queued(record: RunRecord, worker_pid: int | None = None) -> None:
    blue = style.BLUE
    dim = style.DIM
    bold = style.BOLD
    rst = style.RST
    print(f"{blue}◆{rst} {record.kind.value} queued: {blue}{record.run_id}{rst}")
    print(f"{dim}│{rst} status:  {record.status.value}")
    print(f"{dim}│{rst} follow:  {bold}codealmanac jobs attach {record.run_id}{rst}")
    print(f"{dim}│{rst} details: {bold}codealmanac jobs show {record.run_id}{rst}")
    if worker_pid is not None:
        print(f"{dim}│ worker: pid {worker_pid}{rst}")
    quip = RUN_QUIPS.get(record.kind)
    if quip is not None:
        print(f"{dim}◇ {quip}{rst}")


def render_init(result: BuildResult, database_path: Path) -> None:
    repository = result.repository
    print(f"initialized {repository.name}: {index_summary(result.index)}")
    print(f"wiki: {repository.almanac_path}")
    print(f"database: {database_path}")
    if result.run.summary is not None:
        print(f"summary: {result.run.summary}")


def render_init_json(result: BuildResult, database_path: Path) -> None:
    repository = result.repository
    receipt = {
        "repository": repository.name,
        "wiki": repository.almanac_path.as_posix(),
        "database": database_path.as_posix(),
        "pages_indexed": result.index.pages_indexed,
    }
    receipt["run_id"] = result.run.run_id
    receipt["status"] = result.run.status.value
    if result.run.summary is not None:
        receipt["summary"] = result.run.summary
    print(json.dumps(receipt, indent=2))


def render_ingest(result: IngestResult) -> None:
    print(f"ingested {result.run.run_id}: {result.run.status.value}")
    print(f"sources: {len(result.sources)}")
    print(f"wiki_changes: {len(result.safety.changed_files)}")
    if result.run.summary is not None:
        print(f"summary: {result.run.summary}")


def render_garden(result: GardenResult) -> None:
    print(f"gardened {result.run.run_id}: {result.run.status.value}")
    print(f"wiki_changes: {len(result.safety.changed_files)}")
    print(f"health_before: {health_issue_count(result.health_before)}")
    if result.run.summary is not None:
        print(f"summary: {result.run.summary}")


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


def health_issue_count(report: HealthReport) -> int:
    return sum(
        len(items)
        for items in (
            report.orphans,
            report.dead_refs,
            report.broken_links,
            report.broken_xwiki,
            report.empty_topics,
            report.empty_pages,
            report.missing_source_citations,
            report.unused_sources,
            report.duplicate_sources,
        )
    )

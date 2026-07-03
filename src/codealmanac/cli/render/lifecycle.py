import json

from codealmanac.cli.render.common import index_summary, print_json_model
from codealmanac.wiki.index.models import HealthReport
from codealmanac.workflows.garden.models import GardenResult
from codealmanac.workflows.ingest.models import IngestResult
from codealmanac.workflows.init.models import InitResult
from codealmanac.workflows.run_queue.models import RunQueueStartResult
from codealmanac.workflows.sync.models import SyncMode, SyncSummary


def render_init(result: InitResult, *, verbose: bool = False) -> None:
    print(f"initialized {result.workspace.name}: {result.run.status.value}")
    print(f"run: {result.run.run_id}")
    print(f"wiki_changes: {len(result.safety.changed_files)}")
    print(f"index: {index_summary(result.index)}")
    if result.run.summary is not None:
        print(f"summary: {result.run.summary}")
    if verbose:
        print(f"almanac_root: {result.workspace.almanac_path}")
        print(f"existing_pages: {result.existing_page_count}")


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
                    "status": result.run.status.value,
                    "child_pid": result.worker.child_pid,
                },
                indent=2,
            )
        )
        return
    print(f"queued {result.run.run_id}: {result.run.status.value}")
    print(f"worker_pid: {result.worker.child_pid}")


def render_sync_status(summary: SyncSummary, json_output: bool) -> None:
    if json_output:
        print_json_model(summary)
        return
    status_mode = summary.mode == SyncMode.STATUS
    print("sync status:" if status_mode else "sync:")
    print(f"  scanned: {summary.scanned}")
    print(f"  eligible: {summary.eligible}")
    if status_mode:
        print(f"  ready: {len(summary.ready)}")
    else:
        print(f"  started: {len(summary.started)}")
    print(f"  skipped: {len(summary.skipped)}")
    print(f"  needs_attention: {len(summary.needs_attention)}")
    for ready in summary.ready:
        print(
            f"  - ready {ready.app.value} {ready.session_id}: "
            f"lines {ready.from_line}-{ready.to_line}"
        )
    for started in summary.started:
        print(
            f"  - started {started.app.value} {started.session_id}: "
            f"{started.run_id} (lines {started.from_line}-{started.to_line})"
        )
    for item in summary.needs_attention:
        print(f"  - needs attention {item.transcript_path}: {item.reason}")


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

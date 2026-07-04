import json

from codealmanac.cli.render.common import index_summary
from codealmanac.jobs.queue.models import JobQueueStartResult
from codealmanac.wiki.index.models import HealthReport
from codealmanac.workflows.garden.models import GardenResult
from codealmanac.workflows.ingest.models import IngestResult
from codealmanac.workflows.init.models import InitResult


def render_init(result: InitResult, *, verbose: bool = False) -> None:
    print(f"initialized {result.workspace.name}: {result.job.status.value}")
    print(f"job: {result.job.job_id}")
    print(f"wiki_changes: {len(result.safety.changed_files)}")
    print(f"index: {index_summary(result.index)}")
    if result.job.summary is not None:
        print(f"summary: {result.job.summary}")
    if verbose:
        print(f"almanac_root: {result.workspace.almanac_path}")
        print(f"existing_pages: {result.existing_page_count}")


def render_ingest(result: IngestResult) -> None:
    print(f"ingested {result.job.job_id}: {result.job.status.value}")
    print(f"sources: {len(result.sources)}")
    print(f"wiki_changes: {len(result.safety.changed_files)}")
    if result.job.summary is not None:
        print(f"summary: {result.job.summary}")


def render_garden(result: GardenResult) -> None:
    print(f"gardened {result.job.job_id}: {result.job.status.value}")
    print(f"wiki_changes: {len(result.safety.changed_files)}")
    print(f"health_before: {health_issue_count(result.health_before)}")
    if result.job.summary is not None:
        print(f"summary: {result.job.summary}")


def render_job_queue_start(
    result: JobQueueStartResult,
    json_output: bool,
) -> None:
    if json_output:
        print(
            json.dumps(
                {
                    "job_id": result.job.job_id,
                    "status": result.job.status.value,
                    "child_pid": result.worker.child_pid,
                },
                indent=2,
            )
        )
        return
    print(f"queued {result.job.job_id}: {result.job.status.value}")
    print(f"worker_pid: {result.worker.child_pid}")


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

import argparse
import json
import shlex
import sys
from datetime import timedelta

from codealmanac.services.automation.models import (
    AutomationInstallResult,
    AutomationStatusReport,
    AutomationTask,
    AutomationUninstallResult,
    ScheduledJob,
    ScheduledJobStatus,
)
from codealmanac.services.diagnostics.models import DoctorCheck, DoctorReport
from codealmanac.services.index.models import (
    HealthReport,
    IndexRefreshResult,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.runs.models import RunLogEvent, RunRecord
from codealmanac.services.tagging.models import TaggingResult
from codealmanac.services.topics.models import (
    TopicEdgeMutationResult,
    TopicMutationAction,
    TopicMutationResult,
    TopicRewriteMutationResult,
)
from codealmanac.services.updates.models import UpdatePlan, UpdateResult
from codealmanac.workflows.garden.models import GardenResult
from codealmanac.workflows.ingest.models import IngestResult
from codealmanac.workflows.sync.models import SyncMode, SyncSummary


def render_search(rows: tuple[SearchPageResult, ...], json_output: bool) -> None:
    if json_output:
        data = [row.model_dump(mode="json") for row in rows]
        print(json.dumps(data, indent=2))
        return
    if len(rows) == 0:
        print("# 0 results", file=sys.stderr)
        return
    for row in rows:
        print(row.slug)

def render_build(workspace_name: str, result: IndexRefreshResult) -> None:
    print(f"built {workspace_name}: {index_summary(result)}")

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

def render_sync_status(summary: SyncSummary, json_output: bool) -> None:
    if json_output:
        print(json.dumps(summary.model_dump(mode="json"), indent=2))
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

def render_automation_install(
    result: AutomationInstallResult,
    json_output: bool,
) -> None:
    if json_output:
        print(json.dumps(result.model_dump(mode="json"), indent=2))
        return
    print("automation installed")
    for job in result.jobs:
        print_automation_job(job)
    for job in result.disabled:
        print(f"  {job.task.value}: disabled")

def render_automation_uninstall(
    result: AutomationUninstallResult,
    json_output: bool,
) -> None:
    if json_output:
        print(json.dumps(result.model_dump(mode="json"), indent=2))
        return
    if len(result.removed) == 0:
        print("automation not installed")
        return
    print("automation removed")
    for path in result.removed:
        print(f"  plist: {path}")

def render_automation_status(
    report: AutomationStatusReport,
    json_output: bool,
) -> None:
    if json_output:
        print(json.dumps(report.model_dump(mode="json"), indent=2))
        return
    for status in report.statuses:
        render_automation_job_status(status)

def print_automation_job(job: ScheduledJob) -> None:
    print(f"  {job.task.value} interval: {duration_label(job.interval)}")
    if job.task == AutomationTask.SYNC:
        quiet = job.program_arguments[job.program_arguments.index("--quiet") + 1]
        print(f"  sync quiet: {quiet}")
    print(f"  {job.task.value} command: {' '.join(job.program_arguments)}")
    if job.working_directory is not None:
        print(f"  {job.task.value} cwd: {job.working_directory}")
    print(f"  {job.task.value} plist: {job.plist_path}")

def render_automation_job_status(status: ScheduledJobStatus) -> None:
    label = f"{status.task.value} automation"
    if not status.installed:
        print(f"{label}: not installed")
        return
    print(f"{label}: installed")
    print(f"  plist: {status.plist_path}")
    print(f"  launchd loaded: {'yes' if status.loaded else 'no'}")
    if status.interval is not None:
        print(f"  interval: {duration_label(status.interval)}")
    if status.quiet is not None:
        print(f"  quiet: {duration_label(status.quiet)}")

def duration_label(value: timedelta) -> str:
    seconds = int(value.total_seconds())
    return f"{seconds}s"

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
        )
    )

def render_reindex(result: IndexRefreshResult, json_output: bool) -> None:
    if json_output:
        print(json.dumps(result.model_dump(mode="json"), indent=2))
        return
    print(f"reindexed: {index_summary(result)}")

def index_summary(result: IndexRefreshResult) -> str:
    skip_suffix = (
        f"; {result.files_skipped} skipped" if result.files_skipped > 0 else ""
    )
    return (
        f"{result.pages_indexed} {page_word(result.pages_indexed)} "
        f"({result.changed} updated, {result.removed} removed{skip_suffix})"
    )

def render_doctor(report: DoctorReport, json_output: bool) -> None:
    if json_output:
        print(json.dumps(report.model_dump(mode="json"), indent=2))
        return
    print(f"codealmanac v{report.version}")
    print("")
    render_doctor_section("Install", report.install)
    render_doctor_section("Current wiki", report.wiki)

def render_doctor_section(title: str, checks: tuple[DoctorCheck, ...]) -> None:
    if len(checks) == 0:
        return
    print(f"## {title}")
    for check in checks:
        print(f"  {check.status.value} {check.message}")
        if check.fix is not None:
            print(f"    {check.fix}")
    print("")

def render_update_plan(plan: UpdatePlan, json_output: bool) -> None:
    if json_output:
        print(json.dumps(plan.model_dump(mode="json"), indent=2))
        return
    print(f"codealmanac {plan.installed_version}")
    print(f"update status: {plan.status.value}")
    print(f"install method: {plan.method.value}")
    print(f"message: {plan.message}")
    if plan.command:
        print(f"command: {shell_command(plan.command)}")
    if plan.fix is not None:
        print(plan.fix)

def render_update_result(result: UpdateResult, json_output: bool) -> None:
    if json_output:
        print(json.dumps(result.model_dump(mode="json"), indent=2))
        return
    render_update_plan(result.plan, json_output=False)
    if result.exit_code is not None:
        print(f"exit_code: {result.exit_code}")
    if result.stdout:
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
    if result.stderr:
        print(result.stderr, end="" if result.stderr.endswith("\n") else "\n")

def shell_command(command: tuple[str, ...]) -> str:
    return shlex.join(command)

def render_runs(records: tuple[RunRecord, ...], json_output: bool) -> None:
    if json_output:
        data = [record.model_dump(mode="json") for record in records]
        print(json.dumps(data, indent=2))
        return
    if len(records) == 0:
        print("# 0 jobs", file=sys.stderr)
        return
    for record in records:
        title = record.title or ""
        print(
            f"{record.run_id}\t{record.status.value}\t"
            f"{record.operation.value}\t{title}"
        )

def render_run(record: RunRecord, json_output: bool) -> None:
    if json_output:
        print(json.dumps(record.model_dump(mode="json"), indent=2))
        return
    print(f"id: {record.run_id}")
    print(f"operation: {record.operation.value}")
    print(f"status: {record.status.value}")
    if record.title is not None:
        print(f"title: {record.title}")
    if record.summary is not None:
        print(f"summary: {record.summary}")
    if record.error is not None:
        print(f"error: {record.error}")
    if record.harness_transcript is not None:
        print(
            "harness_transcript: "
            f"{record.harness_transcript.kind.value} "
            f"{record.harness_transcript.session_id}"
        )
        if record.harness_transcript.transcript_path is not None:
            print(
                "harness_transcript_path: "
                f"{record.harness_transcript.transcript_path}"
            )
    print(f"created_at: {record.created_at.isoformat()}")
    print(f"updated_at: {record.updated_at.isoformat()}")

def render_run_log(events: tuple[RunLogEvent, ...], json_output: bool) -> None:
    if json_output:
        data = [event.model_dump(mode="json") for event in events]
        print(json.dumps(data, indent=2))
        return
    for event in events:
        print(f"{event.sequence}\t{event.kind.value}\t{event.message}")

def render_page(page: PageView, args: argparse.Namespace) -> None:
    if args.json:
        print(json.dumps(page.model_dump(mode="json"), indent=2))
        return
    if args.body:
        print(body_with_trailing_newline(page.body), end="")
        return
    if args.links:
        print_lines(page.wikilinks_out)
        return
    if args.backlinks:
        print_lines(page.wikilinks_in)
        return
    if args.files:
        print_lines(tuple(ref.path for ref in page.file_refs))
        return
    if args.topics:
        print_lines(page.topics)
        return
    if args.meta:
        print(metadata_header(page))
        return
    if args.lead:
        print(first_paragraph(page.body))
        return
    print(body_with_trailing_newline(page.body), end="")

def print_lines(values: tuple[str, ...]) -> None:
    for value in values:
        print(value)

def metadata_header(page: PageView) -> str:
    lines = [
        f"slug: {page.slug}",
        f"title: {page.title or ''}",
        f"path: {page.file_path}",
    ]
    if page.summary:
        lines.append(f"summary: {page.summary}")
    if page.topics:
        lines.append(f"topics: {', '.join(page.topics)}")
    return "\n".join(lines)

def first_paragraph(body: str) -> str:
    paragraphs = [part.strip() for part in body.split("\n\n") if part.strip()]
    return paragraphs[0] if paragraphs else ""

def body_with_trailing_newline(body: str) -> str:
    if body == "" or body.endswith("\n"):
        return body
    return f"{body}\n"

def render_topics(rows: tuple[TopicSummary, ...]) -> None:
    for row in rows:
        title = row.title or row.slug
        print(f"{row.slug}\t{row.page_count}\t{title}")

def render_topic(topic: TopicDetail) -> None:
    print(f"slug: {topic.slug}")
    print(f"title: {topic.title or ''}")
    if topic.description:
        print(f"description: {topic.description}")
    if topic.parents:
        print(f"parents: {', '.join(topic.parents)}")
    if topic.children:
        print(f"children: {', '.join(topic.children)}")
    if topic.pages:
        print("pages:")
        for slug in topic.pages:
            print(f"  {slug}")
    else:
        print("pages: none")

def render_topic_mutation(result: TopicMutationResult) -> None:
    print(f"{result.slug}: {result.action.value}")

def render_topic_edge_mutation(result: TopicEdgeMutationResult) -> None:
    if result.action == TopicMutationAction.NO_EDGE:
        print(f"no edge {result.child} -> {result.parent}")
        return
    if result.action == TopicMutationAction.ALREADY_LINKED:
        print(f"edge {result.child} -> {result.parent} already exists")
        return
    print(f"{result.action.value} {result.child} -> {result.parent}")

def render_topic_rewrite_mutation(result: TopicRewriteMutationResult) -> None:
    if result.action == TopicMutationAction.UNCHANGED:
        print(f"topic {result.slug} unchanged")
        return
    if result.action == TopicMutationAction.RENAMED:
        print(
            f"renamed {result.slug} -> {result.new_slug} "
            f"({result.pages_updated} {page_word(result.pages_updated)} updated)"
        )
        return
    if result.action == TopicMutationAction.DELETED:
        print(
            f"deleted {result.slug} "
            f"({result.pages_updated} {page_word(result.pages_updated)} untagged)"
        )
        return
    print(f"{result.slug}: {result.action.value}")

def page_word(count: int) -> str:
    return "page" if count == 1 else "pages"

def render_health(report: HealthReport, json_output: bool) -> None:
    if json_output:
        print(json.dumps(report.model_dump(mode="json"), indent=2))
        return
    render_health_section("orphans", tuple(item.slug for item in report.orphans))
    render_health_section(
        "dead_refs",
        tuple(f"{item.slug}\t{item.path}" for item in report.dead_refs),
    )
    render_health_section(
        "broken_links",
        tuple(
            f"{item.source_slug}\t{item.target_slug}" for item in report.broken_links
        ),
    )
    render_health_section(
        "broken_xwiki",
        tuple(
            f"{item.source_slug}\t{item.target_wiki}:{item.target_slug}"
            for item in report.broken_xwiki
        ),
    )
    render_health_section(
        "empty_topics",
        tuple(item.slug for item in report.empty_topics),
    )
    render_health_section(
        "empty_pages",
        tuple(item.slug for item in report.empty_pages),
    )

def render_health_section(name: str, rows: tuple[str, ...]) -> None:
    if not rows:
        print(f"{name} (0): ok")
        return
    print(f"{name} ({len(rows)}):")
    for row in rows:
        print(f"  {row}")

def render_tagging(changed_label: str, unchanged_label: str, result: TaggingResult):
    if result.changed_topics:
        print(f"{result.slug}: {changed_label} {', '.join(result.changed_topics)}")
        return
    unchanged = ", ".join(result.requested_topics)
    print(f"{result.slug}: {unchanged_label} {unchanged}")

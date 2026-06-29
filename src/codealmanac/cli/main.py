import argparse
import json
import sys
from collections.abc import Sequence
from datetime import timedelta
from pathlib import Path

from humanfriendly import InvalidTimespan, parse_timespan
from pydantic import ValidationError

from codealmanac import __version__
from codealmanac.app import create_app
from codealmanac.core.errors import CodeAlmanacError, ValidationFailed
from codealmanac.services.automation.models import (
    AutomationInstallResult,
    AutomationStatusReport,
    AutomationTask,
    AutomationUninstallResult,
    ScheduledJob,
    ScheduledJobStatus,
)
from codealmanac.services.automation.requests import (
    AutomationStatusRequest,
    InstallAutomationRequest,
    UninstallAutomationRequest,
)
from codealmanac.services.diagnostics.models import (
    DoctorCheck,
    DoctorReport,
)
from codealmanac.services.diagnostics.requests import DoctorRequest
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.index.models import (
    HealthReport,
    IndexRefreshResult,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.index.requests import ReindexRequest
from codealmanac.services.pages.requests import ShowPageRequest
from codealmanac.services.runs.models import RunLogEvent, RunRecord
from codealmanac.services.runs.requests import (
    ListRunsRequest,
    ReadRunLogRequest,
    ShowRunRequest,
)
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.services.sources.models import TranscriptApp
from codealmanac.services.tagging.models import TaggingResult
from codealmanac.services.tagging.requests import TagPageRequest, UntagPageRequest
from codealmanac.services.topics.models import (
    TopicEdgeMutationResult,
    TopicMutationAction,
    TopicMutationResult,
    TopicRewriteMutationResult,
)
from codealmanac.services.topics.requests import (
    CreateTopicRequest,
    DeleteTopicRequest,
    DescribeTopicRequest,
    LinkTopicRequest,
    ListTopicsRequest,
    RenameTopicRequest,
    ShowTopicRequest,
    UnlinkTopicRequest,
)
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.garden.models import GardenResult
from codealmanac.workflows.garden.requests import RunGardenRequest
from codealmanac.workflows.ingest.models import IngestResult
from codealmanac.workflows.ingest.requests import RunIngestRequest
from codealmanac.workflows.sync.models import SyncMode, SyncSummary
from codealmanac.workflows.sync.requests import RunSyncRequest, RunSyncStatusRequest

DEFAULT_VIEWER_HOST = "127.0.0.1"
DEFAULT_VIEWER_PORT = 3927


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return dispatch(args)
    except (CodeAlmanacError, ValidationError) as error:
        print(f"codealmanac: {error}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codealmanac",
        description="Maintain a local .almanac wiki for a codebase.",
    )
    parser.add_argument("--version", action="version", version=__version__)
    subcommands = parser.add_subparsers(dest="command", required=True)

    init = subcommands.add_parser("init", help="initialize a local .almanac wiki")
    init.add_argument("path", nargs="?", default=".")
    init.add_argument("--name")
    init.add_argument("--description", default="")

    build = subcommands.add_parser("build", help="build or refresh a local wiki")
    build.add_argument("path", nargs="?", default=".")
    build.add_argument("--name")
    build.add_argument("--description", default="")

    ingest = subcommands.add_parser("ingest", help="ingest local material")
    ingest.add_argument("inputs", nargs="+")
    ingest.add_argument("--wiki")
    ingest.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
        default=HarnessKind.CLAUDE.value,
    )
    ingest.add_argument("--title")
    ingest.add_argument("--guidance")

    garden = subcommands.add_parser("garden", help="garden the local wiki")
    garden.add_argument("--wiki")
    garden.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
        default=HarnessKind.CLAUDE.value,
    )
    garden.add_argument("--title")
    garden.add_argument("--guidance")

    sync = subcommands.add_parser("sync", help="sync quiet local transcripts")
    sync.add_argument("--wiki")
    sync.add_argument("--from", dest="source_apps")
    sync.add_argument("--quiet", default="45m")
    sync.add_argument(
        "--using",
        choices=tuple(kind.value for kind in HarnessKind),
        default=HarnessKind.CLAUDE.value,
    )
    sync.add_argument("--json", action="store_true")
    sync_subcommands = sync.add_subparsers(dest="sync_command")
    sync_status = sync_subcommands.add_parser("status", help="show sync readiness")
    sync_status.add_argument("--wiki")
    sync_status.add_argument("--from", dest="source_apps")
    sync_status.add_argument("--quiet", default="45m")
    sync_status.add_argument("--json", action="store_true")

    subcommands.add_parser("list", help="list registered local wikis")

    search = subcommands.add_parser("search", help="search the local wiki")
    search.add_argument("query", nargs="?")
    search.add_argument("--wiki")
    search.add_argument("--topic", action="append", default=[])
    search.add_argument("--mentions")
    search.add_argument("--include-archive", action="store_true")
    search.add_argument("--archived", action="store_true")
    search.add_argument("--limit", type=int)
    search.add_argument("--json", action="store_true")

    show = subcommands.add_parser("show", help="show a wiki page")
    show.add_argument("slug")
    show.add_argument("--wiki")
    show.add_argument("--json", action="store_true")
    show.add_argument("--body", action="store_true")
    show.add_argument("--meta", action="store_true")
    show.add_argument("--lead", action="store_true")
    show.add_argument("--links", action="store_true")
    show.add_argument("--backlinks", action="store_true")
    show.add_argument("--files", action="store_true")
    show.add_argument("--topics", action="store_true")

    topics = subcommands.add_parser("topics", help="list or inspect topics")
    topics.add_argument("--wiki")
    topic_subcommands = topics.add_subparsers(dest="topic_command")
    topic_show = topic_subcommands.add_parser("show", help="show a topic")
    topic_show.add_argument("slug")
    topic_show.add_argument("--descendants", action="store_true")
    topic_create = topic_subcommands.add_parser("create", help="create a topic")
    topic_create.add_argument("name")
    topic_create.add_argument("--parent", action="append", default=[])
    topic_describe = topic_subcommands.add_parser(
        "describe",
        help="set a topic description",
    )
    topic_describe.add_argument("slug")
    topic_describe.add_argument("description")
    topic_link = topic_subcommands.add_parser("link", help="link topic to parent")
    topic_link.add_argument("child")
    topic_link.add_argument("parent")
    topic_unlink = topic_subcommands.add_parser(
        "unlink",
        help="unlink topic from parent",
    )
    topic_unlink.add_argument("child")
    topic_unlink.add_argument("parent")
    topic_rename = topic_subcommands.add_parser("rename", help="rename a topic")
    topic_rename.add_argument("old_slug")
    topic_rename.add_argument("new_slug")
    topic_delete = topic_subcommands.add_parser("delete", help="delete a topic")
    topic_delete.add_argument("slug")

    health = subcommands.add_parser("health", help="check wiki health")
    health.add_argument("--wiki")
    health.add_argument("--json", action="store_true")

    reindex = subcommands.add_parser("reindex", help="force a full index rebuild")
    reindex.add_argument("--wiki")
    reindex.add_argument("--json", action="store_true")

    doctor = subcommands.add_parser("doctor", help="check local install and wiki")
    doctor.add_argument("--wiki")
    doctor.add_argument("--json", action="store_true")

    jobs = subcommands.add_parser("jobs", help="inspect local lifecycle jobs")
    jobs.add_argument("--wiki")
    jobs.add_argument("--limit", type=int)
    jobs.add_argument("--json", action="store_true")
    job_subcommands = jobs.add_subparsers(dest="jobs_command")
    jobs_show = job_subcommands.add_parser("show", help="show one job record")
    jobs_show.add_argument("run_id")
    jobs_show.add_argument("--json", action="store_true")
    jobs_logs = job_subcommands.add_parser("logs", help="show one job log")
    jobs_logs.add_argument("run_id")
    jobs_logs.add_argument("--json", action="store_true")

    serve = subcommands.add_parser("serve", help="serve the local wiki viewer")
    serve.add_argument("--wiki")
    serve.add_argument("--host", default=DEFAULT_VIEWER_HOST)
    serve.add_argument("--port", type=int, default=DEFAULT_VIEWER_PORT)

    automation = subcommands.add_parser(
        "automation",
        help="manage local scheduled automation",
    )
    automation_subcommands = automation.add_subparsers(
        dest="automation_command",
        required=True,
    )
    automation_install = automation_subcommands.add_parser(
        "install",
        help="install scheduled sync and garden jobs",
    )
    automation_install.add_argument(
        "tasks",
        nargs="*",
        choices=tuple(task.value for task in AutomationTask),
    )
    automation_install.add_argument(
        "--every",
        help="run interval for sync or one selected task",
    )
    automation_install.add_argument(
        "--quiet",
        help="minimum quiet time before sync (default: 45m)",
    )
    automation_install.add_argument(
        "--garden-every",
        help="Garden run interval (default: 4h)",
    )
    automation_install.add_argument(
        "--garden-off",
        action="store_true",
        help="disable scheduled Garden automation",
    )
    automation_install.add_argument("--json", action="store_true")
    automation_uninstall = automation_subcommands.add_parser(
        "uninstall",
        help="remove scheduled jobs",
    )
    automation_uninstall.add_argument(
        "tasks",
        nargs="*",
        choices=tuple(task.value for task in AutomationTask),
    )
    automation_uninstall.add_argument("--json", action="store_true")
    automation_status = automation_subcommands.add_parser(
        "status",
        help="show scheduled automation status",
    )
    automation_status.add_argument(
        "tasks",
        nargs="*",
        choices=tuple(task.value for task in AutomationTask),
    )
    automation_status.add_argument("--json", action="store_true")

    tag = subcommands.add_parser("tag", help="add topics to a page")
    tag.add_argument("slug")
    tag.add_argument("topics", nargs="+")
    tag.add_argument("--wiki")

    untag = subcommands.add_parser("untag", help="remove topics from a page")
    untag.add_argument("slug")
    untag.add_argument("topics", nargs="+")
    untag.add_argument("--wiki")
    return parser


def dispatch(args: argparse.Namespace) -> int:
    app = create_app()
    if args.command == "init":
        workspace = app.workflows.build.initialize(
            InitializeWorkspaceRequest(
                path=Path(args.path),
                name=args.name,
                description=args.description,
            )
        )
        print(workspace.name)
        print(
            f"initialized {workspace.almanac_path} "
            f"(registry: {app.workspaces.store.path})",
            file=sys.stderr,
        )
        return 0
    if args.command == "build":
        result = app.workflows.build.build(
            InitializeWorkspaceRequest(
                path=Path(args.path),
                name=args.name,
                description=args.description,
            )
        )
        render_build(result.workspace.name, result.index)
        return 0
    if args.command == "ingest":
        result = app.workflows.ingest.run(
            RunIngestRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                inputs=tuple(args.inputs),
                harness=HarnessKind(args.using),
                title=args.title,
                guidance=args.guidance,
            )
        )
        render_ingest(result)
        return 0
    if args.command == "garden":
        result = app.workflows.garden.run(
            RunGardenRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                harness=HarnessKind(args.using),
                title=args.title,
                guidance=args.guidance,
            )
        )
        render_garden(result)
        return 0
    if args.command == "sync" and args.sync_command == "status":
        result = app.workflows.sync.status(
            RunSyncStatusRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                apps=parse_sync_apps(args.source_apps),
                quiet=parse_quiet(args.quiet),
            )
        )
        render_sync_status(result, json_output=args.json)
        return 0
    if args.command == "sync":
        result = app.workflows.sync.run(
            RunSyncRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                apps=parse_sync_apps(args.source_apps),
                quiet=parse_quiet(args.quiet),
                harness=HarnessKind(args.using),
            )
        )
        render_sync_status(result, json_output=args.json)
        return 0
    if args.command == "list":
        for workspace in app.workspaces.list():
            print(f"{workspace.name}\t{workspace.root_path}")
        return 0
    if args.command == "search":
        rows = app.search.search(
            SearchPagesRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                query=args.query,
                topics=tuple(args.topic),
                mentions=args.mentions,
                include_archive=args.include_archive,
                archived=args.archived,
                limit=args.limit,
            )
        )
        render_search(rows, json_output=args.json)
        return 0
    if args.command == "show":
        page = app.pages.show(
            ShowPageRequest(cwd=Path.cwd(), wiki=args.wiki, slug=args.slug)
        )
        render_page(page, args)
        return 0
    if args.command == "topics":
        if args.topic_command == "show":
            topic = app.topics.show(
                ShowTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    slug=args.slug,
                    include_descendants=args.descendants,
                )
            )
            render_topic(topic)
            return 0
        if args.topic_command == "create":
            result = app.topics.create(
                CreateTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    name=args.name,
                    parents=tuple(args.parent),
                )
            )
            render_topic_mutation(result)
            return 0
        if args.topic_command == "describe":
            result = app.topics.describe(
                DescribeTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    slug=args.slug,
                    description=args.description,
                )
            )
            render_topic_mutation(result)
            return 0
        if args.topic_command == "link":
            result = app.topics.link(
                LinkTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    child=args.child,
                    parent=args.parent,
                )
            )
            render_topic_edge_mutation(result)
            return 0
        if args.topic_command == "unlink":
            result = app.topics.unlink(
                UnlinkTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    child=args.child,
                    parent=args.parent,
                )
            )
            render_topic_edge_mutation(result)
            return 0
        if args.topic_command == "rename":
            result = app.topics.rename(
                RenameTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    old_slug=args.old_slug,
                    new_slug=args.new_slug,
                )
            )
            render_topic_rewrite_mutation(result)
            return 0
        if args.topic_command == "delete":
            result = app.topics.delete(
                DeleteTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    slug=args.slug,
                )
            )
            render_topic_rewrite_mutation(result)
            return 0
        topics = app.topics.list(ListTopicsRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_topics(topics)
        return 0
    if args.command == "health":
        report = app.health.check(HealthCheckRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_health(report, json_output=args.json)
        return 0
    if args.command == "reindex":
        result = app.index.reindex(ReindexRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_reindex(result, json_output=args.json)
        return 0
    if args.command == "doctor":
        report = app.diagnostics.check(DoctorRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_doctor(report, json_output=args.json)
        return 0
    if args.command == "jobs":
        if args.jobs_command == "show":
            record = app.runs.show(
                ShowRunRequest(cwd=Path.cwd(), wiki=args.wiki, run_id=args.run_id)
            )
            render_run(record, json_output=args.json)
            return 0
        if args.jobs_command == "logs":
            events = app.runs.log(
                ReadRunLogRequest(cwd=Path.cwd(), wiki=args.wiki, run_id=args.run_id)
            )
            render_run_log(events, json_output=args.json)
            return 0
        records = app.runs.list(
            ListRunsRequest(cwd=Path.cwd(), wiki=args.wiki, limit=args.limit)
        )
        render_runs(records, json_output=args.json)
        return 0
    if args.command == "serve":
        return run_serve(app, args)
    if args.command == "automation":
        tasks = parse_automation_tasks(args.tasks)
        if args.automation_command == "install":
            result = app.automation.install(
                InstallAutomationRequest(
                    cwd=Path.cwd(),
                    tasks=tasks,
                    every=parse_optional_duration(args.every, "--every"),
                    quiet=parse_optional_duration(args.quiet, "--quiet"),
                    garden_every=parse_optional_duration(
                        args.garden_every,
                        "--garden-every",
                    ),
                    garden_off=args.garden_off,
                )
            )
            render_automation_install(result, json_output=args.json)
            return 0
        if args.automation_command == "uninstall":
            result = app.automation.uninstall(UninstallAutomationRequest(tasks=tasks))
            render_automation_uninstall(result, json_output=args.json)
            return 0
        if args.automation_command == "status":
            result = app.automation.status(AutomationStatusRequest(tasks=tasks))
            render_automation_status(result, json_output=args.json)
            return 0
    if args.command == "tag":
        result = app.tagging.tag(
            TagPageRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                slug=args.slug,
                topics=tuple(args.topics),
            )
        )
        render_tagging("tagged", "already tagged", result)
        return 0
    if args.command == "untag":
        result = app.tagging.untag(
            UntagPageRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                slug=args.slug,
                topics=tuple(args.topics),
            )
        )
        render_tagging("untagged", "not tagged", result)
        return 0
    raise AssertionError(f"unhandled command: {args.command}")


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


def parse_sync_apps(value: str | None) -> tuple[TranscriptApp, ...]:
    if value is None or value.strip() == "":
        return (TranscriptApp.CLAUDE, TranscriptApp.CODEX)
    apps: list[TranscriptApp] = []
    for raw in value.split(","):
        item = raw.strip()
        try:
            app = TranscriptApp(item)
        except ValueError as error:
            raise ValidationFailed(
                f'invalid --from "{value}" (expected claude,codex)'
            ) from error
        if app not in apps:
            apps.append(app)
    if len(apps) == 0:
        raise ValidationFailed("at least one sync source is required")
    return tuple(apps)


def parse_quiet(value: str) -> timedelta:
    try:
        seconds = parse_timespan(value)
    except InvalidTimespan as error:
        raise ValidationFailed(f"invalid --quiet value: {value}") from error
    return timedelta(seconds=seconds)


def parse_optional_duration(value: str | None, flag: str) -> timedelta | None:
    if value is None:
        return None
    try:
        seconds = parse_timespan(value)
    except InvalidTimespan as error:
        raise ValidationFailed(f"invalid {flag} value: {value}") from error
    return timedelta(seconds=seconds)


def parse_automation_tasks(values: Sequence[str]) -> tuple[AutomationTask, ...]:
    tasks: list[AutomationTask] = []
    for value in values:
        task = AutomationTask(value)
        if task not in tasks:
            tasks.append(task)
    return tuple(tasks)


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


def run_serve(app, args: argparse.Namespace) -> int:
    import uvicorn

    from codealmanac.server.app import create_server_app

    server = create_server_app(app, Path.cwd(), args.wiki)
    print(f"codealmanac viewer: http://{args.host}:{args.port}")
    uvicorn.run(server, host=args.host, port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

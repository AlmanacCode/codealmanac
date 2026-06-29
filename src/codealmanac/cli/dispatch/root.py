import argparse
import sys
from collections.abc import Sequence
from datetime import timedelta
from pathlib import Path

from humanfriendly import InvalidTimespan, parse_timespan

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.root import (
    render_automation_install,
    render_automation_status,
    render_automation_uninstall,
    render_build,
    render_doctor,
    render_garden,
    render_health,
    render_ingest,
    render_page,
    render_reindex,
    render_run,
    render_run_log,
    render_runs,
    render_search,
    render_sync_status,
    render_tagging,
    render_topic,
    render_topic_edge_mutation,
    render_topic_mutation,
    render_topic_rewrite_mutation,
    render_topics,
    render_update_plan,
    render_update_result,
)
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.automation.requests import (
    AutomationStatusRequest,
    InstallAutomationRequest,
    UninstallAutomationRequest,
)
from codealmanac.services.config.models import CodeAlmanacConfig
from codealmanac.services.config.requests import LoadConfigRequest
from codealmanac.services.diagnostics.requests import DoctorRequest
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.index.requests import ReindexRequest
from codealmanac.services.pages.requests import ShowPageRequest
from codealmanac.services.runs.requests import (
    ListRunsRequest,
    ReadRunLogRequest,
    ShowRunRequest,
)
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.services.sources.models import TranscriptApp
from codealmanac.services.tagging.requests import TagPageRequest, UntagPageRequest
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
from codealmanac.services.updates.models import UpdateStatus
from codealmanac.services.updates.requests import CheckUpdateRequest, RunUpdateRequest
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.garden.requests import RunGardenRequest
from codealmanac.workflows.ingest.requests import RunIngestRequest
from codealmanac.workflows.sync.requests import RunSyncRequest, RunSyncStatusRequest


def dispatch(args: argparse.Namespace, app: CodeAlmanac) -> int:
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
        cli_config = load_cli_config(app, args.wiki)
        result = app.workflows.ingest.run(
            RunIngestRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                inputs=tuple(args.inputs),
                harness=resolve_harness(args.using, cli_config),
                title=args.title,
                guidance=args.guidance,
            )
        )
        render_ingest(result)
        return 0
    if args.command == "garden":
        cli_config = load_cli_config(app, args.wiki)
        result = app.workflows.garden.run(
            RunGardenRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                harness=resolve_harness(args.using, cli_config),
                title=args.title,
                guidance=args.guidance,
            )
        )
        render_garden(result)
        return 0
    if args.command == "sync" and args.sync_command == "status":
        cli_config = load_cli_config(app, args.wiki)
        result = app.workflows.sync.status(
            RunSyncStatusRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                apps=parse_sync_apps(args.source_apps),
                quiet=resolve_quiet(args.quiet, cli_config),
            )
        )
        render_sync_status(result, json_output=args.json)
        return 0
    if args.command == "sync":
        cli_config = load_cli_config(app, args.wiki)
        result = app.workflows.sync.run(
            RunSyncRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                apps=parse_sync_apps(args.source_apps),
                quiet=resolve_quiet(args.quiet, cli_config),
                harness=resolve_harness(args.using, cli_config),
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
    if args.command == "update":
        if args.check:
            plan = app.updates.check(CheckUpdateRequest())
            render_update_plan(plan, json_output=args.json)
            return 0
        result = app.updates.run(RunUpdateRequest())
        render_update_result(result, json_output=args.json)
        return 0 if result.status == UpdateStatus.UPDATED else 1
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
            cli_config = load_cli_config(app, None)
            result = app.automation.install(
                InstallAutomationRequest(
                    cwd=Path.cwd(),
                    tasks=tasks,
                    every=parse_optional_duration(args.every, "--every"),
                    quiet=resolve_automation_quiet(args.quiet, cli_config),
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

def load_cli_config(app: CodeAlmanac, wiki: str | None) -> CodeAlmanacConfig:
    return app.config.load(LoadConfigRequest(cwd=Path.cwd(), wiki=wiki))

def resolve_harness(value: str | None, config: CodeAlmanacConfig) -> HarnessKind:
    if value is None:
        return config.harness.default
    return HarnessKind(value)

def resolve_quiet(value: str | None, config: CodeAlmanacConfig) -> timedelta:
    if value is None:
        return config.sync.quiet
    return parse_quiet(value)

def resolve_automation_quiet(
    value: str | None,
    config: CodeAlmanacConfig,
) -> timedelta:
    if value is None:
        return config.sync.quiet
    parsed = parse_optional_duration(value, "--quiet")
    if parsed is None:
        raise AssertionError("parsed automation quiet is unexpectedly empty")
    return parsed

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

def run_serve(app, args: argparse.Namespace) -> int:
    import uvicorn

    from codealmanac.server.app import create_server_app

    server = create_server_app(app, Path.cwd(), args.wiki)
    print(f"codealmanac viewer: http://{args.host}:{args.port}")
    uvicorn.run(server, host=args.host, port=args.port, log_level="warning")
    return 0

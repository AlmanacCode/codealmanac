import argparse
import sys
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.admin import dispatch_admin, is_admin_command
from codealmanac.cli.dispatch.config import (
    load_cli_config,
    resolve_harness,
    resolve_pending_timeout,
    resolve_quiet,
)
from codealmanac.cli.render.root import (
    render_build,
    render_garden,
    render_health,
    render_ingest,
    render_page,
    render_reindex,
    render_search,
    render_sync_status,
    render_tagging,
    render_topic,
    render_topic_edge_mutation,
    render_topic_mutation,
    render_topic_rewrite_mutation,
    render_topics,
    render_workspace_drop,
    render_workspace_list,
)
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.index.requests import ReindexRequest
from codealmanac.services.pages.requests import ShowPageRequest
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
from codealmanac.services.workspaces.requests import (
    DropWorkspaceRequest,
    InitializeWorkspaceRequest,
)
from codealmanac.workflows.garden.requests import RunGardenRequest
from codealmanac.workflows.ingest.requests import RunIngestRequest
from codealmanac.workflows.sync.requests import (
    DEFAULT_SYNC_MAX_FAILED_ATTEMPTS,
    RunSyncRequest,
    RunSyncStatusRequest,
)


def dispatch(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.command == "init":
        workspace = app.workflows.build.initialize(
            InitializeWorkspaceRequest(
                path=Path(args.path),
                almanac_root=Path(args.root) if args.root is not None else None,
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
                almanac_root=Path(args.root) if args.root is not None else None,
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
                pending_timeout=resolve_pending_timeout(args.pending_timeout),
                max_failed_attempts=args.max_failed_attempts
                if args.max_failed_attempts is not None
                else DEFAULT_SYNC_MAX_FAILED_ATTEMPTS,
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
                pending_timeout=resolve_pending_timeout(args.pending_timeout),
                max_failed_attempts=args.max_failed_attempts
                if args.max_failed_attempts is not None
                else DEFAULT_SYNC_MAX_FAILED_ATTEMPTS,
                harness=resolve_harness(args.using, cli_config),
                claim_owner=args.claim_owner,
            )
        )
        render_sync_status(result, json_output=args.json)
        return 0
    if args.command == "list":
        if args.drop is not None:
            result = app.workspaces.drop(
                DropWorkspaceRequest(selector=args.drop, base_path=Path.cwd())
            )
            render_workspace_drop(result, json_output=args.json)
            return 0
        if args.drop_missing:
            result = app.workspaces.drop_missing()
            render_workspace_drop(result, json_output=args.json)
            return 0
        render_workspace_list(app.workspaces.list_registry(), json_output=args.json)
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
    if is_admin_command(args.command):
        return dispatch_admin(args, app)
    if args.command == "serve":
        return run_serve(app, args)
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


def run_serve(app, args: argparse.Namespace) -> int:
    import uvicorn

    from codealmanac.server.app import create_server_app

    server = create_server_app(app, Path.cwd(), args.wiki)
    print(f"codealmanac viewer: http://{args.host}:{args.port}")
    uvicorn.run(server, host=args.host, port=args.port, log_level="warning")
    return 0

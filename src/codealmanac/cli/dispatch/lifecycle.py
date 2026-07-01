import argparse
import sys
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.config import (
    load_cli_config,
    resolve_harness,
    resolve_pending_timeout,
    resolve_quiet,
)
from codealmanac.cli.render.root import (
    render_build,
    render_garden,
    render_ingest,
    render_run_queue_start,
    render_sync_status,
)
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.sources.models import TranscriptApp
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest
from codealmanac.workflows.garden.requests import RunGardenRequest
from codealmanac.workflows.ingest.requests import RunIngestRequest
from codealmanac.workflows.run_queue import DrainRunQueueRequest
from codealmanac.workflows.sync.models import SyncExecution
from codealmanac.workflows.sync.requests import (
    DEFAULT_SYNC_MAX_FAILED_ATTEMPTS,
    RunSyncRequest,
    RunSyncStatusRequest,
)

LIFECYCLE_COMMANDS = frozenset(
    ("__run-worker", "build", "garden", "ingest", "init", "sync")
)


def is_lifecycle_command(command: str | None) -> bool:
    return command in LIFECYCLE_COMMANDS


def dispatch_lifecycle(args: argparse.Namespace, app: CodeAlmanac) -> int:
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
        request = RunIngestRequest(
            cwd=Path.cwd(),
            wiki=args.wiki,
            inputs=tuple(args.inputs),
            harness=resolve_harness(args.using, cli_config),
            title=args.title,
            guidance=args.guidance,
        )
        if args.background:
            result = app.workflows.queue.start_ingest_background(request)
            render_run_queue_start(result, json_output=args.json)
            return 0
        if args.json:
            raise ValidationFailed("--json is only supported with --background")
        result = app.workflows.ingest.run(request)
        render_ingest(result)
        return 0
    if args.command == "garden":
        cli_config = load_cli_config(app, args.wiki)
        request = RunGardenRequest(
            cwd=Path.cwd(),
            wiki=args.wiki,
            harness=resolve_harness(args.using, cli_config),
            title=args.title,
            guidance=args.guidance,
        )
        if args.background:
            result = app.workflows.queue.start_garden_background(request)
            render_run_queue_start(result, json_output=args.json)
            return 0
        if args.json:
            raise ValidationFailed("--json is only supported with --background")
        result = app.workflows.garden.run(request)
        render_garden(result)
        return 0
    if args.command == "__run-worker":
        app.workflows.queue.drain(
            DrainRunQueueRequest(
                cwd=Path(args.cwd),
                wiki=args.wiki,
            )
        )
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
                max_failed_attempts=sync_max_failed_attempts(args),
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
                max_failed_attempts=sync_max_failed_attempts(args),
                harness=resolve_harness(args.using, cli_config),
                execution=sync_execution(args),
                claim_owner=args.claim_owner,
            )
        )
        render_sync_status(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled lifecycle command: {args.command}")


def sync_max_failed_attempts(args: argparse.Namespace) -> int:
    if args.max_failed_attempts is not None:
        return args.max_failed_attempts
    return DEFAULT_SYNC_MAX_FAILED_ATTEMPTS


def sync_execution(args: argparse.Namespace) -> SyncExecution:
    if args.background:
        return SyncExecution.BACKGROUND
    return SyncExecution.FOREGROUND


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

import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.config import (
    load_cli_config,
    resolve_harness,
    resolve_harness_model,
)
from codealmanac.cli.render.root import render_sync_status
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.sources.models import TranscriptApp
from codealmanac.workflows.sync.requests import (
    SyncRequest,
    SyncStatusRequest,
)


def dispatch_sync(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.sync_command == "status":
        return dispatch_sync_status(args, app)
    cli_config = load_cli_config(app, args.wiki)
    harness = resolve_harness(args.using, cli_config)
    result = app.workflows.sync.run(
        SyncRequest(
            repository_name=args.wiki,
            apps=parse_sync_apps(args.source_apps),
            harness=harness,
            model=resolve_harness_model(harness, cli_config),
            auto_commit=cli_config.auto_commit,
        )
    )
    render_sync_status(result, json_output=args.json)
    return 0


def dispatch_sync_status(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.workflows.sync.status(
        SyncStatusRequest(
            repository_name=args.wiki,
            apps=parse_sync_apps(args.source_apps),
        )
    )
    render_sync_status(result, json_output=args.json)
    return 0


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

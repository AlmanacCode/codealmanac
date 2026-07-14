import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.config import (
    load_user_cli_config,
    resolve_harness,
    resolve_harness_model,
)
from codealmanac.cli.render.root import (
    render_run_queue_start,
    render_scheduled_garden,
)
from codealmanac.workflows.garden.requests import GardenRequest
from codealmanac.workflows.ingest.requests import IngestRequest
from codealmanac.workflows.run_queue import ScheduledGardenRequest


def dispatch_ingest(args: argparse.Namespace, app: CodeAlmanac) -> int:
    cli_config = load_user_cli_config(app)
    harness = resolve_harness(args.using, cli_config)
    request = IngestRequest(
        cwd=Path.cwd(),
        repository_name=args.wiki,
        inputs=tuple(args.inputs),
        harness=harness,
        model=resolve_harness_model(harness, cli_config),
        title=args.title,
        guidance=args.guidance,
        auto_commit=cli_config.auto_commit,
    )
    result = app.workflows.queue.start_ingest(request)
    render_run_queue_start(result, json_output=args.json)
    return 0


def dispatch_garden(args: argparse.Namespace, app: CodeAlmanac) -> int:
    cli_config = load_user_cli_config(app)
    harness = resolve_harness(args.using, cli_config)
    request = GardenRequest(
        cwd=Path.cwd(),
        repository_name=args.wiki,
        harness=harness,
        model=resolve_harness_model(harness, cli_config),
        title=args.title,
        guidance=args.guidance,
        auto_commit=cli_config.auto_commit,
    )
    result = app.workflows.queue.start_garden(request)
    render_run_queue_start(result, json_output=args.json)
    return 0


def dispatch_scheduled_garden(args: argparse.Namespace, app: CodeAlmanac) -> int:
    cli_config = app.config.load_user()
    result = app.workflows.queue.start_scheduled_garden(
        ScheduledGardenRequest(
            harness=cli_config.harness.default,
            model=cli_config.harness.model,
            auto_commit=cli_config.auto_commit,
        )
    )
    render_scheduled_garden(result)
    return 0

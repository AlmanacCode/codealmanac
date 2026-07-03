import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.config import load_cli_config, resolve_harness
from codealmanac.cli.render.root import (
    render_garden,
    render_ingest,
    render_job_queue_start,
)
from codealmanac.core.errors import ValidationFailed
from codealmanac.workflows.garden.requests import RunGardenRequest
from codealmanac.workflows.ingest.requests import RunIngestRequest


def dispatch_ingest(args: argparse.Namespace, app: CodeAlmanac) -> int:
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
        render_job_queue_start(result, json_output=args.json)
        return 0
    if args.json:
        raise ValidationFailed("--json is only supported with --background")
    result = app.workflows.ingest.run(request)
    render_ingest(result)
    return 0


def dispatch_garden(args: argparse.Namespace, app: CodeAlmanac) -> int:
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
        render_job_queue_start(result, json_output=args.json)
        return 0
    if args.json:
        raise ValidationFailed("--json is only supported with --background")
    result = app.workflows.garden.run(request)
    render_garden(result)
    return 0

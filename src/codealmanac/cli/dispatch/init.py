import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.config import resolve_harness
from codealmanac.cli.render.root import render_init, render_job_queue_start
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.config.models import CodeAlmanacConfig
from codealmanac.workflows.init.requests import RunInitRequest


def dispatch_init(args: argparse.Namespace, app: CodeAlmanac) -> int:
    cli_config = CodeAlmanacConfig()
    request = RunInitRequest(
        path=Path(args.path),
        almanac_root=Path(args.root) if args.root is not None else None,
        name=args.name,
        description=args.description,
        harness=resolve_harness(args.using, cli_config),
        guidance=args.guidance,
        force=args.force,
    )
    if args.background:
        result = app.workflows.queue.start_init_background(request)
        render_job_queue_start(result, json_output=args.json)
        return 0
    if args.json:
        raise ValidationFailed("--json is only supported with --background")
    result = app.workflows.init.run(request)
    render_init(result, verbose=args.verbose)
    return 0

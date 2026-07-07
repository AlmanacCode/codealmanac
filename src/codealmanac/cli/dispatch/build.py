import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.config import (
    load_user_cli_config,
    resolve_harness,
    resolve_harness_model,
)
from codealmanac.cli.render.root import render_run_queue_start
from codealmanac.workflows.build.requests import BuildRequest


def dispatch_init(args: argparse.Namespace, app: CodeAlmanac) -> int:
    cli_config = load_user_cli_config(app)
    harness = resolve_harness(args.using, cli_config)
    request = BuildRequest(
        path=Path(args.path),
        harness=harness,
        model=resolve_harness_model(harness, cli_config),
        name=args.name,
        description=args.description,
        guidance=args.guidance,
        auto_commit=cli_config.auto_commit,
    )
    result = app.workflows.queue.start_build(request)
    render_run_queue_start(result, json_output=args.json)
    return 0

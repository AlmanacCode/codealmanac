import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.jobs.queue import DrainJobQueueRequest


def dispatch_run_worker(args: argparse.Namespace, app: CodeAlmanac) -> int:
    app.workflows.queue.drain(
        DrainJobQueueRequest(
            cwd=Path(args.cwd),
            wiki=args.wiki,
        )
    )
    return 0

import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.workflows.run_queue import DrainRunQueueRequest, ExecuteRunRequest


def dispatch_run_worker(args: argparse.Namespace, app: CodeAlmanac) -> int:
    app.workflows.queue.drain(DrainRunQueueRequest())
    return 0


def dispatch_run_executor(args: argparse.Namespace, app: CodeAlmanac) -> int:
    app.workflows.queue.execute(ExecuteRunRequest(run_id=args.run_id))
    return 0

import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.workflows.run_queue import DrainRunQueueRequest


def dispatch_run_worker(args: argparse.Namespace, app: CodeAlmanac) -> int:
    app.workflows.queue.drain(DrainRunQueueRequest())
    return 0

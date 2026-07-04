import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from pydantic import ValidationError

from codealmanac.app import CodeAlmanac, create_app
from codealmanac.core.errors import CodeAlmanacError
from codealmanac.jobs.queue import DrainJobQueueRequest


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return run(args, create_app())
    except (CodeAlmanacError, ValidationError) as error:
        print(f"codealmanac-job-worker: {error}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codealmanac-job-worker",
        description="Drain queued local CodeAlmanac lifecycle jobs.",
    )
    parser.add_argument("--cwd", required=True)
    parser.add_argument("--wiki")
    return parser


def run(args: argparse.Namespace, app: CodeAlmanac) -> int:
    app.workflows.queue.drain(
        DrainJobQueueRequest(
            cwd=Path(args.cwd),
            wiki=args.wiki,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

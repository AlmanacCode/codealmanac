import argparse
import json
import sys
from collections.abc import Sequence

from pydantic import ValidationError

from codealmanac.app import CodeAlmanac, create_app
from codealmanac.core.errors import CodeAlmanacError
from codealmanac.engine.harnesses.models import HarnessKind
from codealmanac.local.runs.kinds import LocalRunKind
from codealmanac.local.runs.worker.requests import RunNextLocalWorkerRequest


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return run(args, create_app())
    except (CodeAlmanacError, ValidationError) as error:
        print(f"codealmanac-local-worker: {error}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codealmanac-local-worker",
        description="Run one pending local CodeAlmanac trigger.",
    )
    parser.add_argument("--repository-id")
    parser.add_argument("--branch-id")
    parser.add_argument(
        "--operation",
        default=LocalRunKind.UPDATE.value,
        choices=tuple(kind.value for kind in LocalRunKind),
    )
    parser.add_argument(
        "--using",
        default=HarnessKind.CODEX.value,
        choices=tuple(kind.value for kind in HarnessKind),
    )
    parser.add_argument("--title")
    parser.add_argument("--guidance")
    parser.add_argument("--json", action="store_true")
    return parser


def run(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.workflows.local_worker.run_next(
        RunNextLocalWorkerRequest(
            repository_id=args.repository_id,
            branch_id=args.branch_id,
            operation=args.operation,
            harness=HarnessKind(args.using),
            title=args.title,
            guidance=args.guidance,
        )
    )
    if args.json:
        print(json.dumps(result.model_dump(mode="json")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

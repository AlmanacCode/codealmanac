import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from pydantic import ValidationError

from codealmanac.app import CodeAlmanac, create_app
from codealmanac.core.errors import CodeAlmanacError
from codealmanac.local.control.models import TriggerEventKind
from codealmanac.local.control.requests import RecordCurrentGitTriggerRequest
from codealmanac.local.runs.worker.requests import SpawnLocalWorkerRequest


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return run(args, create_app())
    except (CodeAlmanacError, ValidationError) as error:
        print(f"codealmanac-local-trigger: {error}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codealmanac-local-trigger",
        description="Record a local CodeAlmanac trigger event.",
    )
    parser.add_argument("--cwd", default=".")
    parser.add_argument(
        "--kind",
        required=True,
        choices=(
            "local_post_commit",
            "local_post_merge",
            "local_post_rewrite",
            "manual",
        ),
    )
    parser.add_argument("--previous-head")
    parser.add_argument("--payload-ref")
    parser.add_argument("--spawn-worker", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser


def run(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.control.record_current_git_trigger(
        RecordCurrentGitTriggerRequest(
            cwd=Path(args.cwd),
            kind=TriggerEventKind(args.kind),
            previous_head_sha=args.previous_head,
            payload_ref=args.payload_ref,
        )
    )
    worker = None
    if args.spawn_worker and result.event is not None:
        worker = app.local_worker_spawner.spawn(
            SpawnLocalWorkerRequest(
                cwd=Path(args.cwd),
                repository_id=result.event.repository_id,
                branch_id=result.event.branch_id,
            )
        )
    if args.json:
        payload = result.model_dump(mode="json")
        if worker is not None:
            payload["worker"] = worker.model_dump(mode="json")
        print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

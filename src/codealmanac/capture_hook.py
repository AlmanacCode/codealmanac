import argparse
import json
import sys
from collections.abc import Sequence
from typing import cast

from pydantic import ValidationError

from codealmanac.app import CodeAlmanac, create_app
from codealmanac.cli.render.capture import render_capture_hook_event
from codealmanac.cloud.capture.models import CaptureProvider
from codealmanac.cloud.capture.requests import CaptureHookRequest
from codealmanac.core.errors import CodeAlmanacError, ValidationFailed


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return run(args, create_app())
    except (CodeAlmanacError, ValidationError) as error:
        print(f"codealmanac-capture-hook: {error}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codealmanac-capture-hook",
        description="Record a CodeAlmanac cloud capture hook event.",
    )
    parser.add_argument("--provider", choices=("codex", "claude"), required=True)
    return parser


def run(args: argparse.Namespace, app: CodeAlmanac) -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError as error:
        raise ValidationFailed(f"invalid capture hook JSON: {error}") from error
    if not isinstance(payload, dict):
        raise ValidationFailed("invalid capture hook JSON: expected object")
    try:
        event = app.capture.record_hook(
            CaptureHookRequest(
                provider=cast(CaptureProvider, args.provider),
                payload=payload,
            )
        )
    except CodeAlmanacError:
        return 0
    render_capture_hook_event(event)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

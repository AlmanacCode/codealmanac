import argparse
import json
import sys
from typing import cast

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.capture import (
    render_capture_disable,
    render_capture_enable,
    render_capture_hook_event,
    render_capture_status,
)
from codealmanac.core.errors import CodeAlmanacError, ValidationFailed
from codealmanac.services.cloud_capture.models import (
    ALL_CAPTURE_PROVIDERS,
    CaptureProvider,
)
from codealmanac.services.cloud_capture.requests import (
    CaptureDisableRequest,
    CaptureEnableRequest,
    CaptureHookRequest,
    CaptureRepairRequest,
    CaptureStatusRequest,
)


def dispatch_capture(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.capture_command == "status":
        result = app.capture.status(
            CaptureStatusRequest(
                api_url=args.api_url,
                check_cloud=args.check_cloud,
            )
        )
        render_capture_status(result, json_output=args.json)
        return 0
    if args.capture_command == "enable":
        result = app.capture.enable(
            CaptureEnableRequest(
                api_url=args.api_url,
                providers=providers_for(args.target),
            )
        )
        render_capture_enable(result, json_output=args.json)
        return 0
    if args.capture_command == "repair":
        result = app.capture.repair(
            CaptureRepairRequest(
                api_url=args.api_url,
                providers=providers_for(args.target),
            )
        )
        render_capture_enable(result, json_output=args.json)
        return 0
    if args.capture_command == "disable":
        result = app.capture.disable(
            CaptureDisableRequest(
                api_url=args.api_url,
                providers=providers_for(args.target),
                revoke_remote=not args.keep_credential,
            )
        )
        render_capture_disable(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled capture command: {args.capture_command}")


def dispatch_capture_hook(args: argparse.Namespace, app: CodeAlmanac) -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError as error:
        raise ValidationFailed(f"invalid capture hook JSON: {error}") from error
    if not isinstance(payload, dict):
        raise ValidationFailed("invalid capture hook JSON: expected object")
    try:
        event = app.capture.record_hook(
            CaptureHookRequest(provider=args.provider, payload=payload)
        )
    except CodeAlmanacError:
        return 0
    render_capture_hook_event(event)
    return 0


def providers_for(value: str) -> tuple[CaptureProvider, ...]:
    if value == "all":
        return ALL_CAPTURE_PROVIDERS
    return (cast(CaptureProvider, value),)

import argparse
from typing import cast

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.capture import (
    render_capture_disable,
    render_capture_enable,
    render_capture_inspect,
    render_capture_status,
)
from codealmanac.cloud.capture.models import (
    ALL_CAPTURE_PROVIDERS,
    CaptureProvider,
)
from codealmanac.cloud.capture.requests import (
    CaptureDisableRequest,
    CaptureEnableRequest,
    CaptureInspectRequest,
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
    if args.capture_command == "inspect":
        result = app.capture.inspect(CaptureInspectRequest(limit=args.limit))
        render_capture_inspect(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled capture command: {args.capture_command}")


def providers_for(value: str) -> tuple[CaptureProvider, ...]:
    if value == "all":
        return ALL_CAPTURE_PROVIDERS
    return (cast(CaptureProvider, value),)

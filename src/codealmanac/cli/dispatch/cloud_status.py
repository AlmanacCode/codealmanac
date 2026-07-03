import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.cloud_status import render_cloud_status_overview
from codealmanac.workflows.cloud_status.requests import ReadCloudStatusRequest


def dispatch_cloud_status(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.workflows.cloud_status.status(
        ReadCloudStatusRequest(
            cwd=Path.cwd(),
            api_url=args.api_url,
            check_capture_cloud=args.check_cloud,
        )
    )
    render_cloud_status_overview(result, json_output=args.json)
    return 0

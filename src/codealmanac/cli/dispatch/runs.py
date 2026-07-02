import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.cloud_runs import (
    render_cloud_run,
    render_cloud_run_log,
    render_cloud_runs,
)
from codealmanac.workflows.cloud_runs.requests import (
    CancelCloudRunWorkflowRequest,
    ListCloudRunsRequest,
    ReadCloudRunLogRequest,
    RetryCloudRunWorkflowRequest,
    ShowCloudRunRequest,
    StartCloudRunRequest,
)


def dispatch_runs(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.runs_command == "list":
        result = app.workflows.cloud_runs.list(
            ListCloudRunsRequest(
                cwd=Path.cwd(),
                api_url=args.api_url,
                limit=args.limit,
                cursor=args.cursor,
            )
        )
        render_cloud_runs(result, json_output=args.json)
        return 0
    if args.runs_command == "start":
        result = app.workflows.cloud_runs.start(
            StartCloudRunRequest(
                cwd=Path.cwd(),
                api_url=args.api_url,
                branch=args.branch,
            )
        )
        render_cloud_run(result, json_output=args.json)
        return 0
    if args.runs_command == "show":
        result = app.workflows.cloud_runs.show(
            ShowCloudRunRequest(api_url=args.api_url, run_id=args.run_id)
        )
        render_cloud_run(result, json_output=args.json)
        return 0
    if args.runs_command == "cancel":
        result = app.workflows.cloud_runs.cancel(
            CancelCloudRunWorkflowRequest(api_url=args.api_url, run_id=args.run_id)
        )
        render_cloud_run(result, json_output=args.json)
        return 0
    if args.runs_command == "retry":
        result = app.workflows.cloud_runs.retry(
            RetryCloudRunWorkflowRequest(api_url=args.api_url, run_id=args.run_id)
        )
        render_cloud_run(result, json_output=args.json)
        return 0
    if args.runs_command == "logs":
        result = app.workflows.cloud_runs.log(
            ReadCloudRunLogRequest(api_url=args.api_url, run_id=args.run_id)
        )
        render_cloud_run_log(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled runs command: {args.runs_command}")

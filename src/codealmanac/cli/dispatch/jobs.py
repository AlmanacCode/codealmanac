import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.admin import (
    render_run,
    render_run_attach_stream,
    render_run_cancel,
    render_run_log,
    render_runs,
)
from codealmanac.services.runs.requests import (
    CancelRunRequest,
    ListRunsRequest,
    ReadRunLogRequest,
    ShowRunRequest,
    StreamRunAttachRequest,
)


def dispatch_jobs(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.jobs_command == "show":
        record = app.runs.show(
            ShowRunRequest(repository_name=args.wiki, run_id=args.run_id)
        )
        render_run(record, json_output=args.json)
        return 0
    if args.jobs_command == "logs":
        events = app.runs.log(
            ReadRunLogRequest(repository_name=args.wiki, run_id=args.run_id)
        )
        render_run_log(events, json_output=args.json)
        return 0
    if args.jobs_command == "attach":
        updates = app.runs.stream_attach(
            StreamRunAttachRequest(repository_name=args.wiki, run_id=args.run_id)
        )
        render_run_attach_stream(updates, json_output=args.json)
        return 0
    if args.jobs_command == "cancel":
        result = app.runs.cancel(
            CancelRunRequest(repository_name=args.wiki, run_id=args.run_id)
        )
        render_run_cancel(result, json_output=args.json)
        return 0
    records = app.runs.list(
        ListRunsRequest(repository_name=args.wiki, limit=args.limit)
    )
    render_runs(records, json_output=args.json)
    return 0

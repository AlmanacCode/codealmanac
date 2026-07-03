import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.admin import (
    render_job,
    render_job_attach_stream,
    render_job_cancel,
    render_job_log,
    render_jobs,
)
from codealmanac.jobs.ledger.requests import (
    CancelJobRequest,
    ListJobsRequest,
    ReadJobLogRequest,
    ShowJobRequest,
    StreamJobAttachRequest,
)


def dispatch_jobs(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.jobs_command == "show":
        record = app.jobs.show(
            ShowJobRequest(cwd=Path.cwd(), wiki=args.wiki, job_id=args.job_id)
        )
        render_job(record, json_output=args.json)
        return 0
    if args.jobs_command == "logs":
        events = app.jobs.log(
            ReadJobLogRequest(cwd=Path.cwd(), wiki=args.wiki, job_id=args.job_id)
        )
        render_job_log(events, json_output=args.json)
        return 0
    if args.jobs_command == "attach":
        updates = app.jobs.stream_attach(
            StreamJobAttachRequest(cwd=Path.cwd(), wiki=args.wiki, job_id=args.job_id)
        )
        render_job_attach_stream(updates, json_output=args.json)
        return 0
    if args.jobs_command == "cancel":
        result = app.jobs.cancel(
            CancelJobRequest(cwd=Path.cwd(), wiki=args.wiki, job_id=args.job_id)
        )
        render_job_cancel(result, json_output=args.json)
        return 0
    records = app.jobs.list(
        ListJobsRequest(cwd=Path.cwd(), wiki=args.wiki, limit=args.limit)
    )
    render_jobs(records, json_output=args.json)
    return 0

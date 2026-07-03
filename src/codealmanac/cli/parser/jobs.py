import argparse


def add_jobs_commands(subcommands: argparse._SubParsersAction) -> None:
    jobs = subcommands.add_parser("jobs", help=argparse.SUPPRESS)
    jobs.add_argument("--wiki")
    jobs.add_argument("--limit", type=int)
    jobs.add_argument("--json", action="store_true")
    job_subcommands = jobs.add_subparsers(dest="jobs_command")
    jobs_show = job_subcommands.add_parser("show", help="show one job record")
    jobs_show.add_argument("run_id")
    jobs_show.add_argument("--json", action="store_true")
    jobs_logs = job_subcommands.add_parser("logs", help="show one job log")
    jobs_logs.add_argument("run_id")
    jobs_logs.add_argument("--json", action="store_true")
    jobs_attach = job_subcommands.add_parser(
        "attach",
        help="stream one job log until the job exits",
    )
    jobs_attach.add_argument("run_id")
    jobs_attach.add_argument("--json", action="store_true")
    jobs_cancel = job_subcommands.add_parser(
        "cancel",
        help="cancel one queued or running job",
    )
    jobs_cancel.add_argument("run_id")
    jobs_cancel.add_argument("--json", action="store_true")

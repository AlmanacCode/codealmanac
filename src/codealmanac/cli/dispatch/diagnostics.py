import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.admin import render_doctor
from codealmanac.diagnostics.requests import DoctorRequest


def dispatch_doctor(args: argparse.Namespace, app: CodeAlmanac) -> int:
    report = app.diagnostics.check(
        DoctorRequest(
            cwd=Path.cwd(),
            wiki=args.wiki,
            include_harnesses=args.harnesses,
        )
    )
    render_doctor(report, json_output=args.json)
    return 0

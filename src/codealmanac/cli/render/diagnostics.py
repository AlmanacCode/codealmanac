from codealmanac.cli.render.common import print_json_model
from codealmanac.diagnostics.models import DoctorCheck, DoctorReport


def render_doctor(report: DoctorReport, json_output: bool) -> None:
    if json_output:
        print_json_model(report)
        return
    print(f"codealmanac v{report.version}")
    print("")
    render_doctor_section("Install", report.install)
    render_doctor_section("Current wiki", report.wiki)
    render_doctor_section("Harnesses", report.harnesses)


def render_doctor_section(title: str, checks: tuple[DoctorCheck, ...]) -> None:
    if len(checks) == 0:
        return
    print(f"## {title}")
    for check in checks:
        print(f"  {check.status.value} {check.message}")
        if check.fix is not None:
            print(f"    {check.fix}")
    print("")

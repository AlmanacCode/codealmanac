from datetime import timedelta

from codealmanac.cli.render.common import print_json_model
from codealmanac.cli.render.style import humanize_duration
from codealmanac.services.automation.models import (
    AutomationInstallResult,
    AutomationStatusReport,
    AutomationUninstallResult,
    ScheduledJob,
    ScheduledJobStatus,
)


def render_automation_install(
    result: AutomationInstallResult,
    json_output: bool,
) -> None:
    if json_output:
        print_json_model(result)
        return
    print("automation installed")
    for job in result.jobs:
        print_automation_job(job)
    for job in result.disabled:
        print(f"  {job.task.value}: disabled")


def render_automation_uninstall(
    result: AutomationUninstallResult,
    json_output: bool,
) -> None:
    if json_output:
        print_json_model(result)
        return
    if len(result.removed) == 0:
        print("automation not installed")
        return
    print("automation removed")
    for path in result.removed:
        print(f"  plist: {path}")


def render_automation_status(
    report: AutomationStatusReport,
    json_output: bool,
) -> None:
    if json_output:
        print_json_model(report)
        return
    for status in report.statuses:
        render_automation_job_status(status)


def print_automation_job(job: ScheduledJob) -> None:
    print(f"  {job.task.value} interval: {duration_label(job.interval)}")
    print(f"  {job.task.value} command: {' '.join(job.program_arguments)}")
    print(f"  {job.task.value} plist: {job.plist_path}")


def render_automation_job_status(status: ScheduledJobStatus) -> None:
    label = f"{status.task.value} automation"
    if not status.installed:
        print(f"{label}: not installed")
        return
    print(f"{label}: installed")
    print(f"  plist: {status.plist_path}")
    print(f"  launchd loaded: {'yes' if status.loaded else 'no'}")
    if status.interval is not None:
        print(f"  interval: {duration_label(status.interval)}")


def duration_label(value: timedelta) -> str:
    return humanize_duration(value)

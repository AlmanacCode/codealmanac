from datetime import timedelta

from codealmanac.cli.render.common import print_json_model
from codealmanac.cli.render.style import humanize_duration
from codealmanac.services.automation.models import (
    AutomationStatusReport,
    ScheduledJobStatus,
)


def render_automation_status(
    report: AutomationStatusReport,
    json_output: bool,
) -> None:
    if json_output:
        print_json_model(report)
        return
    for status in report.statuses:
        render_automation_job_status(status)


def render_automation_job_status(status: ScheduledJobStatus) -> None:
    label = f"{status.task.value} automation"
    if not status.installed:
        print(f"{label}: not installed")
        return
    print(f"{label}: installed")
    print(f"  manifest: {status.manifest_path}")
    print(f"  scheduler loaded: {'yes' if status.loaded else 'no'}")
    if status.interval is not None:
        print(f"  interval: {duration_label(status.interval)}")
    if status.state is not None:
        print(f"  state: {status.state.value}")
    if status.run_count is not None:
        print(f"  runs: {status.run_count}")
    if status.last_exit_code is not None:
        result = "succeeded" if status.last_exit_code == 0 else "failed"
        print(f"  last result: {result} (exit {status.last_exit_code})")
    elif status.run_count == 0:
        print("  last result: not run yet")
    if status.pid is not None:
        print(f"  pid: {status.pid}")


def duration_label(value: timedelta) -> str:
    return humanize_duration(value)

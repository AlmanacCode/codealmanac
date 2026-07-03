from codealmanac.cli.render.automation import (
    render_automation_install,
    render_automation_status,
    render_automation_uninstall,
)
from codealmanac.cli.render.cloud_runs import (
    render_cloud_run,
    render_cloud_run_log,
    render_cloud_runs,
)
from codealmanac.cli.render.diagnostics import render_doctor
from codealmanac.cli.render.jobs import (
    render_job,
    render_job_attach,
    render_job_attach_stream,
    render_job_cancel,
    render_job_log,
    render_jobs,
)
from codealmanac.cli.render.setup import render_setup_result, render_uninstall_result
from codealmanac.cli.render.updates import render_update_plan, render_update_result

__all__ = [
    "render_automation_install",
    "render_automation_status",
    "render_automation_uninstall",
    "render_doctor",
    "render_cloud_run",
    "render_cloud_run_log",
    "render_cloud_runs",
    "render_job",
    "render_job_attach",
    "render_job_attach_stream",
    "render_job_cancel",
    "render_job_log",
    "render_jobs",
    "render_setup_result",
    "render_uninstall_result",
    "render_update_plan",
    "render_update_result",
]

from codealmanac.services.automation.models import ScheduledJob, ScheduledJobStatus


class UnsupportedSchedulerAdapter:
    """No-op scheduler for platforms without a supported backend.

    On non-macOS hosts CodeAlmanac has no scheduler yet, so automation reconcile
    must not shell out to `launchctl` or write launchd artifacts. Every method
    reports "not installed" and touches nothing on disk, letting `setup` and
    `config` complete cleanly instead of crashing.
    """

    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        return not_installed(job)

    def uninstall(self, job: ScheduledJob) -> bool:
        return False

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        return not_installed(job)


def not_installed(job: ScheduledJob) -> ScheduledJobStatus:
    return ScheduledJobStatus(
        task=job.task,
        label=job.label,
        plist_path=job.plist_path,
        installed=False,
        loaded=False,
    )

from typing import Protocol

from codealmanac.services.automation.models import ScheduledJob, ScheduledJobStatus


class SchedulerAdapter(Protocol):
    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        """Install and activate one scheduled job."""

    def uninstall(self, job: ScheduledJob) -> bool:
        """Remove one scheduled job. Return true when a manifest was removed."""

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        """Read persisted scheduler state for one job."""

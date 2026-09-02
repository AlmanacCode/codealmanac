import sys

from codealmanac.integrations.automation.scheduler.launchd import (
    LaunchdSchedulerAdapter,
)
from codealmanac.integrations.automation.scheduler.systemd import (
    SystemdSchedulerAdapter,
)
from codealmanac.services.automation.ports import SchedulerAdapter


def default_scheduler_adapter() -> SchedulerAdapter:
    """Return the scheduler backend for the current platform."""
    if sys.platform == "darwin":
        return LaunchdSchedulerAdapter()
    return SystemdSchedulerAdapter()


__all__ = [
    "LaunchdSchedulerAdapter",
    "SystemdSchedulerAdapter",
    "default_scheduler_adapter",
]

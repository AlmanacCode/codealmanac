import sys

from codealmanac.integrations.automation.scheduler.launchd import (
    LaunchdSchedulerAdapter,
)
from codealmanac.integrations.automation.scheduler.systemd import (
    SystemdSchedulerAdapter,
)
from codealmanac.services.automation.ports import SchedulerAdapter


def default_scheduler_adapter() -> SchedulerAdapter:
    if sys.platform.startswith("linux"):
        return SystemdSchedulerAdapter()
    return LaunchdSchedulerAdapter()


__all__ = [
    "LaunchdSchedulerAdapter",
    "SystemdSchedulerAdapter",
    "default_scheduler_adapter",
]

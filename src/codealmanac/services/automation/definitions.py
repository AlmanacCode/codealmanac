from dataclasses import dataclass
from datetime import timedelta

from codealmanac.services.automation.defaults import (
    DEFAULT_GARDEN_INTERVAL,
    DEFAULT_SYNC_INTERVAL,
    DEFAULT_UPDATE_INTERVAL,
    GARDEN_LABEL,
    SYNC_LABEL,
    UPDATE_LABEL,
)
from codealmanac.services.automation.models import AutomationTask


@dataclass(frozen=True)
class AutomationTaskDefinition:
    task: AutomationTask
    label: str
    default_interval: timedelta
    stdout_log_name: str
    stderr_log_name: str


def task_definition(task: AutomationTask) -> AutomationTaskDefinition:
    if task == AutomationTask.SYNC:
        return AutomationTaskDefinition(
            task=AutomationTask.SYNC,
            label=SYNC_LABEL,
            default_interval=DEFAULT_SYNC_INTERVAL,
            stdout_log_name="sync.out.log",
            stderr_log_name="sync.err.log",
        )
    if task == AutomationTask.UPDATE:
        return AutomationTaskDefinition(
            task=AutomationTask.UPDATE,
            label=UPDATE_LABEL,
            default_interval=DEFAULT_UPDATE_INTERVAL,
            stdout_log_name="update.out.log",
            stderr_log_name="update.err.log",
        )
    return AutomationTaskDefinition(
        task=AutomationTask.GARDEN,
        label=GARDEN_LABEL,
        default_interval=DEFAULT_GARDEN_INTERVAL,
        stdout_log_name="garden.out.log",
        stderr_log_name="garden.err.log",
    )

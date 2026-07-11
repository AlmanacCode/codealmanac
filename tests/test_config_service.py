from datetime import timedelta
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import ExecutionFailed, ValidationFailed
from codealmanac.services.automation.models import ScheduledJob, ScheduledJobStatus
from codealmanac.services.config.models import ConfigKey
from codealmanac.services.config.requests import (
    ApplyConfigRequest,
    SetConfigValueRequest,
)
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.settings import AppConfig


class FakeScheduler:
    def __init__(self):
        self.installed: list[ScheduledJob] = []
        self.uninstalled: list[ScheduledJob] = []

    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        self.installed.append(job)
        return scheduler_status(job, installed=True)

    def uninstall(self, job: ScheduledJob) -> bool:
        self.uninstalled.append(job)
        return True

    def status(self, job: ScheduledJob) -> ScheduledJobStatus:
        return scheduler_status(job, installed=False)


class FailOnceScheduler(FakeScheduler):
    def __init__(self, fail_task: str):
        super().__init__()
        self.fail_task = fail_task
        self.failed = False

    def install(self, job: ScheduledJob) -> ScheduledJobStatus:
        if job.task.value == self.fail_task and not self.failed:
            self.failed = True
            raise ExecutionFailed(f"failed to install {job.task.value}")
        return super().install(job)


def test_config_service_returns_defaults_without_file(
    isolated_home: Path,
) -> None:
    app = config_app(isolated_home)

    config = app.config.load_user()

    assert config.auto_commit is True
    assert config.harness.default == HarnessKind.CODEX
    assert config.harness.model == "gpt-5.5"
    assert config.automation.sync.enabled is True
    assert config.automation.sync.every == timedelta(hours=5)
    assert config.automation.garden.every == timedelta(hours=4)
    assert config.automation.update.every == timedelta(hours=24)


def test_config_service_loads_complete_user_toml(
    isolated_home: Path,
) -> None:
    path = config_path(isolated_home)
    write_config(
        path,
        """
auto_commit = false

[harness]
default = "claude"
model = "claude-opus-4-7"

[automation.sync]
enabled = true
every = "30m"

[automation.garden]
enabled = false
every = "6h"

[automation.update]
enabled = true
every = "1d"
""",
    )

    config = config_app(isolated_home).config.load_user()

    assert config.auto_commit is False
    assert config.harness.default == HarnessKind.CLAUDE
    assert config.automation.sync.every == timedelta(minutes=30)
    assert config.automation.garden.enabled is False
    assert config.automation.update.every == timedelta(days=1)


def test_repository_config_is_not_read(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    project = tmp_path / "almanac/config.toml"
    write_config(
        project,
        """
[harness]
default = "claude"
model = "claude-opus-4-7"
""",
    )

    config = config_app(isolated_home).config.load_user()

    assert config.harness.default == HarnessKind.CODEX


def test_config_service_reports_invalid_toml(isolated_home: Path) -> None:
    write_config(config_path(isolated_home), '[harness\ndefault = "codex"\n')

    with pytest.raises(ValidationFailed, match="invalid config TOML"):
        config_app(isolated_home).config.load_user()


@pytest.mark.parametrize("every", ["0s", "-1h", "tomorrow"])
def test_config_service_rejects_invalid_automation_intervals(
    isolated_home: Path,
    every: str,
) -> None:
    write_config(
        config_path(isolated_home),
        f"""
[automation.sync]
every = "{every}"
""",
    )

    with pytest.raises(ValidationFailed, match="invalid config"):
        config_app(isolated_home).config.load_user()


def test_config_set_writes_normal_values(isolated_home: Path) -> None:
    app = config_app(isolated_home)

    app.config.set(set_request(ConfigKey.AUTO_COMMIT, "false"))
    app.config.set(set_request(ConfigKey.HARNESS_DEFAULT, "claude"))
    app.config.set(set_request(ConfigKey.HARNESS_MODEL, "claude-opus-4-7"))

    config = app.config.load_user()
    assert config.auto_commit is False
    assert config.harness.default == HarnessKind.CLAUDE
    assert config.harness.model == "claude-opus-4-7"


def test_config_set_automation_interval_writes_and_reconciles(
    isolated_home: Path,
) -> None:
    scheduler = FakeScheduler()
    app = config_app(isolated_home, scheduler)

    result = app.config.set(set_request(ConfigKey.AUTOMATION_SYNC_EVERY, "8h"))

    assert result.value == "8h"
    assert result.automation is not None
    assert result.automation.task.value == "sync"
    assert app.config.load_user().automation.sync.every == timedelta(hours=8)
    assert scheduler.installed[0].task.value == "sync"
    assert scheduler.installed[0].interval == timedelta(hours=8)
    assert scheduler.uninstalled == []


def test_config_set_automation_disabled_writes_and_removes(
    isolated_home: Path,
) -> None:
    scheduler = FakeScheduler()
    app = config_app(isolated_home, scheduler)

    result = app.config.set(set_request(ConfigKey.AUTOMATION_GARDEN_ENABLED, "false"))

    assert result.automation is not None
    assert result.automation.enabled is False
    assert scheduler.installed == []
    assert scheduler.uninstalled[0].task.value == "garden"


def test_config_apply_reconciles_direct_toml_edit(
    isolated_home: Path,
) -> None:
    scheduler = FakeScheduler()
    app = config_app(isolated_home, scheduler)
    write_config(
        config_path(isolated_home),
        """
[automation.sync]
enabled = true
every = "8h"

[automation.garden]
enabled = false
every = "4h"

[automation.update]
enabled = true
every = "12h"
""",
    )

    result = app.config.apply(ApplyConfigRequest(home=isolated_home))

    assert tuple(item.task.value for item in result.automation) == (
        "sync",
        "garden",
        "update",
    )
    assert [job.task.value for job in scheduler.installed] == ["sync", "update"]
    assert [job.task.value for job in scheduler.uninstalled] == ["garden"]


def test_scheduler_failure_keeps_desired_toml_for_retry(
    isolated_home: Path,
) -> None:
    scheduler = FailOnceScheduler("sync")
    app = config_app(isolated_home, scheduler)

    with pytest.raises(ExecutionFailed, match="failed to install sync"):
        app.config.set(set_request(ConfigKey.AUTOMATION_SYNC_EVERY, "8h"))

    assert app.config.load_user().automation.sync.every == timedelta(hours=8)
    app.config.apply(ApplyConfigRequest(home=isolated_home))
    assert [job.task.value for job in scheduler.installed] == [
        "sync",
        "garden",
        "update",
    ]


def test_config_apply_rejects_invalid_toml_without_scheduler_calls(
    isolated_home: Path,
) -> None:
    scheduler = FakeScheduler()
    app = config_app(isolated_home, scheduler)
    write_config(config_path(isolated_home), '[automation.sync\nevery = "8h"\n')

    with pytest.raises(ValidationFailed, match="invalid config TOML"):
        app.config.apply(ApplyConfigRequest(home=isolated_home))

    assert scheduler.installed == []
    assert scheduler.uninstalled == []


def test_failed_multi_task_apply_can_be_retried(
    isolated_home: Path,
) -> None:
    scheduler = FailOnceScheduler("garden")
    app = config_app(isolated_home, scheduler)
    write_config(
        config_path(isolated_home),
        """
[automation.sync]
every = "8h"

[automation.garden]
every = "6h"
""",
    )

    with pytest.raises(ExecutionFailed, match="failed to install garden"):
        app.config.apply(ApplyConfigRequest(home=isolated_home))

    result = app.config.apply(ApplyConfigRequest(home=isolated_home))
    assert tuple(item.task.value for item in result.automation) == (
        "sync",
        "garden",
        "update",
    )
    assert [job.task.value for job in scheduler.installed] == [
        "sync",
        "sync",
        "garden",
        "update",
    ]


def test_config_set_rejects_invalid_values_without_writing(
    isolated_home: Path,
) -> None:
    app = config_app(isolated_home)
    path = config_path(isolated_home)

    with pytest.raises(ValidationFailed, match="must be true or false"):
        app.config.set(set_request(ConfigKey.AUTOMATION_SYNC_ENABLED, "maybe"))
    with pytest.raises(ValidationFailed, match="must be greater than zero"):
        app.config.set(set_request(ConfigKey.AUTOMATION_SYNC_EVERY, "0s"))
    with pytest.raises(ValidationFailed, match="harness.default must be one of"):
        app.config.set(set_request(ConfigKey.HARNESS_DEFAULT, "gpt"))

    assert not path.exists()


def config_app(isolated_home: Path, scheduler: FakeScheduler | None = None):
    return create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        scheduler=scheduler or FakeScheduler(),
    )


def config_path(isolated_home: Path) -> Path:
    return isolated_home / ".codealmanac/config.toml"


def write_config(path: Path, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


def set_request(key: ConfigKey, value: str) -> SetConfigValueRequest:
    return SetConfigValueRequest(key=key, value=value)


def scheduler_status(job: ScheduledJob, installed: bool) -> ScheduledJobStatus:
    return ScheduledJobStatus(
        task=job.task,
        label=job.label,
        plist_path=job.plist_path,
        installed=installed,
        loaded=installed,
        interval=job.interval if installed else None,
    )

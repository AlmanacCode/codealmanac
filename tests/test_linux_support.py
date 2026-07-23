"""Option A Linux support: automation degrades gracefully off macOS.

These tests force the platform via ``sys.platform`` so they behave identically
on macOS and Linux CI. ``scheduler_supported`` reads ``sys.platform`` live, so
patching it flips the whole adapter-selection chain.
"""

import subprocess
import sys
from pathlib import Path

import pytest

from codealmanac.app import create_app, default_scheduler_adapter
from codealmanac.cli.main import main
from codealmanac.core.platform import scheduler_supported
from codealmanac.integrations.automation import (
    LaunchdSchedulerAdapter,
    UnsupportedSchedulerAdapter,
)
from codealmanac.services.automation.jobs import (
    AutomationJobFactory,
    default_job_for_task,
)
from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.config.models import (
    AutomationConfig,
    GardenAutomationConfig,
    HarnessConfig,
    SyncAutomationConfig,
    TelemetryConfig,
    UpdateAutomationConfig,
)
from codealmanac.services.config.requests import UpdateUserConfigRequest
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.settings import AppConfig


def force_platform(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    monkeypatch.setattr(sys, "platform", value)


def test_scheduler_supported_tracks_platform(monkeypatch: pytest.MonkeyPatch) -> None:
    force_platform(monkeypatch, "darwin")
    assert scheduler_supported() is True
    force_platform(monkeypatch, "linux")
    assert scheduler_supported() is False


def test_default_adapter_selected_by_platform(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    force_platform(monkeypatch, "darwin")
    assert isinstance(default_scheduler_adapter(), LaunchdSchedulerAdapter)
    force_platform(monkeypatch, "linux")
    assert isinstance(default_scheduler_adapter(), UnsupportedSchedulerAdapter)


def test_unsupported_adapter_is_a_noop(isolated_home: Path) -> None:
    job = default_job_for_task(AutomationJobFactory(), AutomationTask.SYNC)
    adapter = UnsupportedSchedulerAdapter()

    installed = adapter.install(job)
    status = adapter.status(job)

    assert installed.installed is False
    assert status.installed is False
    assert adapter.uninstall(job) is False
    # No launchd artifacts are written on the unsupported path.
    assert not job.plist_path.exists()
    assert not job.plist_path.parent.exists()


def test_app_picks_unsupported_scheduler_off_macos(
    isolated_home: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    force_platform(monkeypatch, "linux")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    assert isinstance(app.automation.scheduler, UnsupportedSchedulerAdapter)


def test_config_update_does_not_crash_off_macos(
    isolated_home: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    force_platform(monkeypatch, "linux")
    # Fail loudly if the launchd path is ever taken on this platform.
    monkeypatch.setattr(
        "codealmanac.integrations.automation.scheduler.launchd.subprocess.run",
        _fail_if_called,
    )
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    result = app.config.update(_enabled_automation_request(isolated_home))

    # Config records intent, but nothing was actually scheduled.
    assert Path(result.path).exists()
    assert all(item.enabled for item in result.automation)
    assert all(not item.scheduled for item in result.automation)


def test_cli_setup_reports_scheduling_unavailable_off_macos(
    isolated_home: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    force_platform(monkeypatch, "linux")
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db"),
        harness_adapters=(NoopHarnessAdapter(),),
    )
    monkeypatch.setattr("codealmanac.cli.main.create_app", lambda: app)

    exit_code = main(["setup", "--yes"])
    output = capsys.readouterr().out

    assert exit_code == 0
    assert "Scheduled automation unavailable" in output
    # The macOS-only "Background Items" nag is never shown off macOS.
    assert "Background Items Added" not in output


class NoopHarnessAdapter:
    kind = HarnessKind.CODEX

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(kind=self.kind, available=True, message="codex ready")

    def run(self, request: object, on_event: object = None) -> HarnessRunResult:
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="ok",
            summary="ok",
        )


def _fail_if_called(*_args: object, **_kwargs: object) -> subprocess.CompletedProcess:
    raise AssertionError("launchctl must not be invoked on an unsupported platform")


def _enabled_automation_request(home: Path) -> UpdateUserConfigRequest:
    return UpdateUserConfigRequest(
        auto_commit=True,
        harness=HarnessConfig(),
        telemetry=TelemetryConfig(enabled=False),
        automation=AutomationConfig(
            sync=SyncAutomationConfig(enabled=True),
            garden=GardenAutomationConfig(enabled=True),
            update=UpdateAutomationConfig(enabled=True),
        ),
        home=home,
    )

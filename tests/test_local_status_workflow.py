from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.local.control.models import ControlDeliveryMode
from codealmanac.local.control.requests import (
    SetBranchPolicyRequest,
    UpsertRepositoryRequest,
)
from codealmanac.local.setup.models import LocalRepositoryState
from codealmanac.local.status.requests import ReadLocalStatusRequest


class FakeLocalRepositoryProbe:
    def __init__(self, state: LocalRepositoryState):
        self.state = state
        self.requests: list[Path] = []

    def read(self, cwd: Path) -> LocalRepositoryState:
        self.requests.append(cwd)
        return self.state


def test_local_status_reports_configured_checkout_branch(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    probe = FakeLocalRepositoryProbe(available_state(repo))
    app = create_app(
        AppConfig(control_db_path=isolated_home / ".codealmanac/control.sqlite"),
        local_repository_probe=probe,
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo,
        )
    )
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(
            repository_id=repository.id,
            name="dev",
            trigger_enabled=True,
            delivery_mode=ControlDeliveryMode.COMMIT,
        )
    )

    result = app.workflows.local_status.status(ReadLocalStatusRequest(cwd=repo / "src"))

    assert result.checkout.available is True
    assert result.repository == repository
    assert result.branch == branch
    assert result.repository_configured is True
    assert result.branch_configured is True
    assert probe.requests == [repo / "src"]


def test_local_status_reports_unconfigured_branch(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(control_db_path=isolated_home / ".codealmanac/control.sqlite"),
        local_repository_probe=FakeLocalRepositoryProbe(available_state(repo)),
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo,
        )
    )

    result = app.workflows.local_status.status(ReadLocalStatusRequest(cwd=repo))

    assert result.repository == repository
    assert result.branch is None
    assert result.repository_configured is True
    assert result.branch_configured is False


def test_local_status_reports_unavailable_checkout(
    tmp_path: Path,
    isolated_home: Path,
):
    app = create_app(
        AppConfig(control_db_path=isolated_home / ".codealmanac/control.sqlite"),
        local_repository_probe=FakeLocalRepositoryProbe(
            LocalRepositoryState(
                cwd=tmp_path,
                available=False,
                unavailable_reason="not inside a Git checkout",
            )
        ),
    )

    result = app.workflows.local_status.status(ReadLocalStatusRequest(cwd=tmp_path))

    assert result.checkout.available is False
    assert result.checkout.unavailable_reason == "not inside a Git checkout"
    assert result.repository is None
    assert result.branch is None


def available_state(repo: Path) -> LocalRepositoryState:
    return LocalRepositoryState(
        cwd=repo,
        available=True,
        repository_root=repo,
        branch_name="dev",
        head_sha="head-1",
        provider="github",
        owner_login="AlmanacCode",
        name="codealmanac",
        full_name="AlmanacCode/codealmanac",
        default_branch="main",
    )

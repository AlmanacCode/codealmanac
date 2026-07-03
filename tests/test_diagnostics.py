from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.services.diagnostics.models import DoctorStatus
from codealmanac.services.diagnostics.requests import DoctorRequest
from codealmanac.wiki.workspaces.requests import (
    InitializeWorkspaceRequest,
    RegisterWorkspaceRequest,
)


def test_doctor_reports_no_wiki_without_failing(
    tmp_path: Path,
    isolated_home: Path,
):
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )

    report = app.diagnostics.check(DoctorRequest(cwd=tmp_path))

    assert report.install[0].key == "install.version"
    assert {check.key for check in report.install} >= {"install.manual"}
    assert report.wiki[0].key == "wiki.none"
    assert report.wiki[0].status == DoctorStatus.INFO
    assert report.wiki[0].fix == "run: codealmanac init"


def test_doctor_does_not_materialize_missing_registered_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    app.workspaces.register(RegisterWorkspaceRequest(root_path=repo, name="repo"))

    report = app.diagnostics.check(DoctorRequest(cwd=repo))

    checks = {check.key: check for check in report.wiki}
    assert checks["wiki.registered"].status == DoctorStatus.PROBLEM
    assert checks["wiki.registered"].fix == "run: codealmanac init"
    assert not (repo / "almanac").exists()


def test_doctor_reports_index_and_health_for_selected_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo, name="repo")
    )
    app.index.ensure_fresh(workspace.workspace_id)

    report = app.diagnostics.check(DoctorRequest(cwd=tmp_path, wiki="repo"))

    checks = {check.key: check for check in report.wiki}
    assert checks["wiki.repo"].message == f"repo: {repo}"
    assert checks["wiki.registered"].status == DoctorStatus.OK
    assert checks["wiki.index"].status == DoctorStatus.OK
    assert checks["wiki.index"].message.startswith("index: 1 page, 1 topic")
    assert checks["wiki.manual"].status == DoctorStatus.OK
    assert checks["wiki.manual"].message == "manual: 8 docs"
    assert checks["wiki.health"].status == DoctorStatus.OK
    assert checks["wiki.health"].message == "health: 0 problems"


def test_doctor_reports_missing_workspace_manual(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo, name="repo")
    )
    app.index.ensure_fresh(workspace.workspace_id)
    (repo / "almanac/manual/pages.md").unlink()

    report = app.diagnostics.check(DoctorRequest(cwd=repo))

    checks = {check.key: check for check in report.wiki}
    assert checks["wiki.manual"].status == DoctorStatus.PROBLEM
    assert checks["wiki.manual"].message == "manual missing: pages.md"
    assert checks["wiki.manual"].fix == "run: codealmanac init --force"


def test_doctor_reports_changed_workspace_manual(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(registry_path=isolated_home / ".codealmanac/registry.json")
    )
    workspace = app.workflows.init.initialize_workspace(
        InitializeWorkspaceRequest(path=repo, name="repo")
    )
    app.index.ensure_fresh(workspace.workspace_id)
    (repo / "almanac/manual/README.md").write_text(
        "local manual edit\n",
        encoding="utf-8",
    )

    report = app.diagnostics.check(DoctorRequest(cwd=repo))

    checks = {check.key: check for check in report.wiki}
    assert checks["wiki.manual"].status == DoctorStatus.INFO
    assert checks["wiki.manual"].message == "manual differs: README.md"
    assert (
        checks["wiki.manual"].fix
        == "review local manual files; codealmanac init --force refreshes the wiki"
    )

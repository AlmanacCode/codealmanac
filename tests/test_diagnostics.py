from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.services.diagnostics.models import DoctorStatus
from codealmanac.services.diagnostics.requests import DoctorRequest
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest


def test_doctor_reports_no_wiki_without_failing(
    tmp_path: Path,
    isolated_home: Path,
):
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))

    report = app.diagnostics.check(DoctorRequest(cwd=tmp_path))

    assert report.install[0].key == "install.version"
    assert {check.key for check in report.install} >= {"install.manual"}
    assert report.wiki[0].key == "wiki.none"
    assert report.wiki[0].status == DoctorStatus.INFO
    assert report.wiki[0].fix == "run: codealmanac init"


def test_doctor_reports_index_and_health_for_selected_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.workflows.build.build(InitializeWorkspaceRequest(path=repo, name="repo"))

    report = app.diagnostics.check(DoctorRequest(cwd=tmp_path, wiki="repo"))

    checks = {check.key: check for check in report.wiki}
    assert checks["wiki.repo"].message == f"repo: {repo}"
    assert checks["wiki.registered"].status == DoctorStatus.OK
    assert checks["wiki.index"].status == DoctorStatus.OK
    assert checks["wiki.index"].message.startswith("index: 1 page, 4 topics")
    assert checks["wiki.manual"].status == DoctorStatus.OK
    assert checks["wiki.manual"].message == "manual: 8 docs"
    assert checks["wiki.health"].status == DoctorStatus.PROBLEM
    assert checks["wiki.health"].fix == "run: codealmanac health"


def test_doctor_reports_missing_workspace_manual(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.workflows.build.build(InitializeWorkspaceRequest(path=repo, name="repo"))
    (repo / ".almanac/manual/pages.md").unlink()

    report = app.diagnostics.check(DoctorRequest(cwd=repo))

    checks = {check.key: check for check in report.wiki}
    assert checks["wiki.manual"].status == DoctorStatus.PROBLEM
    assert checks["wiki.manual"].message == "manual missing: pages.md"
    assert checks["wiki.manual"].fix == "run: codealmanac build"

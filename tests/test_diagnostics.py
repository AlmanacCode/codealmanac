from pathlib import Path

from conftest import initialize_repository

from codealmanac.app import create_app
from codealmanac.services.diagnostics.models import DoctorStatus
from codealmanac.services.diagnostics.requests import DoctorRequest
from codealmanac.services.repositories.requests import (
    RegisterRepositoryRequest,
)
from codealmanac.settings import AppConfig


def test_doctor_reports_no_wiki_without_failing(
    tmp_path: Path,
    isolated_home: Path,
):
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    report = app.diagnostics.check(DoctorRequest(cwd=tmp_path))

    assert report.install[0].key == "install.version"
    assert {check.key for check in report.install} >= {"install.manual"}
    assert report.wiki[0].key == "wiki.none"
    assert report.wiki[0].status == DoctorStatus.INFO
    assert report.wiki[0].fix == (
        "run from a registered repository root or pass --wiki <name>"
    )


def test_doctor_does_not_materialize_missing_registered_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    app.repositories.register(RegisterRepositoryRequest(root_path=repo, name="repo"))

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
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=repo, name="repo")

    report = app.diagnostics.check(DoctorRequest(cwd=tmp_path, repository_name="repo"))

    checks = {check.key: check for check in report.wiki}
    assert checks["wiki.repo"].message == f"repo: {repo}"
    assert checks["wiki.registered"].status == DoctorStatus.OK
    assert checks["wiki.index"].status == DoctorStatus.OK
    assert checks["wiki.index"].message.startswith("index: 1 page, 1 topic")
    assert "wiki.manual" not in checks
    assert checks["wiki.health"].status == DoctorStatus.OK
    assert checks["wiki.health"].message == "health: 0 problems"

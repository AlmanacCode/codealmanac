import json
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.core.errors import NotFoundError
from codealmanac.core.models import AppConfig
from codealmanac.core.paths import default_run_artifacts_path
from codealmanac.services.engine_runs.models import (
    COMMIT_SUBJECT_PREFIX,
    EngineChangedFile,
    EngineFileChangeKind,
    EngineRunResult,
    EngineRunStatus,
)
from codealmanac.services.engine_runs.requests import (
    PrepareEngineRunRequest,
    ReadEngineRunRequest,
    WriteEngineRunResultRequest,
)


def test_default_run_artifacts_path_uses_codealmanac_home(isolated_home: Path):
    expected = isolated_home / ".codealmanac/runs"

    assert default_run_artifacts_path() == expected
    assert AppConfig().run_artifacts_path == expected


def test_engine_run_prepare_writes_request_artifact(
    tmp_path: Path,
    isolated_home: Path,
):
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
        )
    )
    repo_path = tmp_path / "repo"
    sources_path = isolated_home / ".codealmanac/source-bundles/run-1"

    prepared = app.engine_runs.prepare(
        PrepareEngineRunRequest(
            run_id="run-1",
            repository_id="repo_1",
            branch_id="branch_1",
            repository_full_name="AlmanacCode/codealmanac",
            branch_name="dev",
            expected_head_sha="abc123",
            repo_path=repo_path,
            almanac_root=Path("almanac"),
            sources_path=sources_path,
            source_bundle_ref="file://source-bundles/run-1",
        )
    )

    assert prepared.paths.run_path == isolated_home / ".codealmanac/runs/run-1"
    assert prepared.paths.request_path.is_file()
    assert prepared.paths.artifacts_path.is_dir()
    assert prepared.request.run_path == prepared.paths.run_path
    assert prepared.request.sources_path == sources_path
    assert prepared.request.source_bundle_ref == "file://source-bundles/run-1"

    reloaded = app.engine_runs.read_request(ReadEngineRunRequest(run_id="run-1"))
    raw = json.loads(prepared.paths.request_path.read_text(encoding="utf-8"))

    assert reloaded == prepared.request
    assert raw["sources_path"] == str(sources_path)
    assert raw["source_bundle_ref"] == "file://source-bundles/run-1"
    assert "sources" not in raw
    assert "sessions" not in raw
    assert "conversation" not in raw


def test_engine_run_result_round_trips_with_commit_subject_style(
    tmp_path: Path,
    isolated_home: Path,
):
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
        )
    )
    app.engine_runs.prepare(
        PrepareEngineRunRequest(
            run_id="run-2",
            repository_id="repo_1",
            branch_id="branch_1",
            repository_full_name="AlmanacCode/codealmanac",
            branch_name="dev",
            expected_head_sha="abc123",
            repo_path=tmp_path / "repo",
            almanac_root=Path("almanac"),
            sources_path=isolated_home / ".codealmanac/source-bundles/run-2",
        )
    )

    result = app.engine_runs.write_result(
        WriteEngineRunResultRequest(
            run_id="run-2",
            status=EngineRunStatus.SUCCEEDED,
            summary="Updated the auth wiki page.",
            commit_subject=f"{COMMIT_SUBJECT_PREFIX} update auth docs",
            commit_body="Refreshes the page after the dev branch trigger.",
            changed_files=(
                EngineChangedFile(
                    path=Path("almanac/pages/auth-flow.md"),
                    kind=EngineFileChangeKind.UPDATED,
                    summary="Auth flow page updated.",
                ),
            ),
            result_artifact_refs=("file://runs/run-2/wiki.patch",),
        )
    )

    reloaded = app.engine_runs.read_result(ReadEngineRunRequest(run_id="run-2"))

    assert reloaded == result
    assert result.status is EngineRunStatus.SUCCEEDED
    assert result.commit_subject == "docs almanac: update auth docs"
    assert result.changed_files[0].path == Path("almanac/pages/auth-flow.md")


def test_engine_run_result_requires_prepared_request(isolated_home: Path):
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
        )
    )

    with pytest.raises(NotFoundError):
        app.engine_runs.write_result(
            WriteEngineRunResultRequest(
                run_id="missing-run",
                status=EngineRunStatus.FAILED,
                error="worker failed",
            )
        )


def test_engine_run_result_rejects_non_almanac_commit_subject():
    with pytest.raises(ValueError):
        EngineRunResult(
            run_id="run-3",
            status=EngineRunStatus.SUCCEEDED,
            commit_subject="docs: update auth docs",
        )

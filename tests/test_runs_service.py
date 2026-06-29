from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.services.runs.models import RunEventKind, RunOperation, RunStatus
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    ListRunsRequest,
    ReadRunLogRequest,
    RecordRunEventRequest,
    ShowRunRequest,
    StartRunRequest,
)
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest


def test_runs_service_records_job_and_events(
    tmp_path: Path,
    isolated_home: Path,
):
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.build.initialize(InitializeWorkspaceRequest(path=repo))

    record = app.runs.start(
        StartRunRequest(
            cwd=repo,
            operation=RunOperation.INGEST,
            title="Digest design note",
        )
    )
    event = app.runs.record_event(
        RecordRunEventRequest(
            cwd=repo,
            run_id=record.run_id,
            kind=RunEventKind.MESSAGE,
            message="read design note",
        )
    )
    finished = app.runs.finish(
        FinishRunRequest(
            cwd=repo,
            run_id=record.run_id,
            status=RunStatus.DONE,
            summary="updated wiki",
        )
    )
    listed = app.runs.list(ListRunsRequest(cwd=repo))
    shown = app.runs.show(ShowRunRequest(cwd=repo, run_id=record.run_id))
    log = app.runs.log(ReadRunLogRequest(cwd=repo, run_id=record.run_id))

    assert record.status == RunStatus.QUEUED
    assert event.sequence == 2
    assert finished.status == RunStatus.DONE
    assert finished.summary == "updated wiki"
    assert [run.run_id for run in listed] == [record.run_id]
    assert shown.status == RunStatus.DONE
    assert shown.log_path == Path(".almanac/jobs") / f"{record.run_id}.jsonl"
    assert tuple(entry.kind for entry in log) == (
        RunEventKind.STATUS,
        RunEventKind.MESSAGE,
        RunEventKind.STATUS,
    )
    assert (repo / ".almanac/jobs" / f"{record.run_id}.json").is_file()
    assert (repo / ".almanac/jobs" / f"{record.run_id}.jsonl").is_file()


def test_runs_service_targets_registered_wiki(
    tmp_path: Path,
    isolated_home: Path,
):
    first = tmp_path / "first"
    second = tmp_path / "second"
    first.mkdir()
    second.mkdir()
    app = create_app(AppConfig(registry_path=isolated_home / ".almanac/registry.json"))
    app.build.initialize(InitializeWorkspaceRequest(path=first, name="first"))
    app.build.initialize(InitializeWorkspaceRequest(path=second, name="second"))

    record = app.runs.start(
        StartRunRequest(cwd=second, wiki="first", operation=RunOperation.GARDEN)
    )

    assert (first / ".almanac/jobs" / f"{record.run_id}.json").is_file()
    assert app.runs.list(ListRunsRequest(cwd=second, wiki="first"))[0].run_id == (
        record.run_id
    )


def test_finish_run_request_requires_terminal_status(tmp_path: Path):
    with pytest.raises(ValidationError):
        FinishRunRequest(
            cwd=tmp_path,
            run_id="run-1",
            status=RunStatus.RUNNING,
        )

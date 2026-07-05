from pathlib import Path

from codealmanac.app import create_app
from codealmanac.core.models import AppConfig
from codealmanac.engine.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.engine.runs.models import (
    EngineFileChangeKind,
    EngineRunStatus,
)
from codealmanac.engine.runs.requests import (
    PrepareEngineRunRequest,
    ReadEngineRunRequest,
)
from codealmanac.local.control.models import ControlRunEventKind, ControlRunStatus
from codealmanac.local.control.requests import (
    CreateControlRunRequest,
    ListControlRunEventsRequest,
    SetBranchPolicyRequest,
    UpsertRepositoryRequest,
)
from codealmanac.local.runs.execution.requests import ExecuteLocalEngineRunRequest


class FakeHarnessAdapter:
    kind = HarnessKind.CODEX

    def __init__(self, result: HarnessRunResult):
        self.result = result
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message="fake ready",
        )

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        self.requests.append(request)
        return self.result


def test_local_engine_executes_prepared_request_and_writes_result(
    tmp_path: Path,
    isolated_home: Path,
):
    repo_path = tmp_path / "repo"
    sources_path = tmp_path / "sources"
    changed_path = Path("almanac/pages/auth.md")
    (repo_path / changed_path).parent.mkdir(parents=True)
    (repo_path / changed_path).write_text("# Auth\n", encoding="utf-8")
    sources_path.mkdir()
    fake_harness = FakeHarnessAdapter(
        HarnessRunResult(
            kind=HarnessKind.CODEX,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="Refresh auth page\nDone.",
            summary="Refresh auth page.",
            changed_files=(changed_path,),
        )
    )
    app, run = local_engine_app(
        isolated_home,
        fake_harness,
        repo_path,
        sources_path,
    )

    result = app.workflows.local_engine.execute(
        ExecuteLocalEngineRunRequest(run_id=run.id, title="Update wiki")
    )
    reloaded_engine = app.engine.runs.read_result(ReadEngineRunRequest(run_id=run.id))
    events = app.control.list_run_events(ListControlRunEventsRequest(run_id=run.id))

    assert result.executed is True
    assert result.run.status is ControlRunStatus.RUNNING
    assert result.run.result_ref is not None
    assert result.run.result_ref.startswith("file://")
    assert result.engine == reloaded_engine
    assert reloaded_engine.status is EngineRunStatus.SUCCEEDED
    assert reloaded_engine.summary == "Refresh auth page."
    assert reloaded_engine.commit_subject == "docs almanac: refresh auth page"
    assert reloaded_engine.commit_body == "Refresh auth page."
    assert reloaded_engine.changed_files[0].path == changed_path
    assert reloaded_engine.changed_files[0].kind is EngineFileChangeKind.UPDATED
    assert fake_harness.requests[0].cwd == repo_path
    assert fake_harness.requests[0].title == "Update wiki"
    assert '"sources_path"' in fake_harness.requests[0].prompt
    assert str(sources_path) in fake_harness.requests[0].prompt
    assert "Do not commit" in fake_harness.requests[0].prompt
    assert tuple(event.kind for event in events) == (
        ControlRunEventKind.STATUS,
        ControlRunEventKind.OUTPUT,
        ControlRunEventKind.STATUS,
    )
    assert events[0].message == "started local engine worker"
    assert events[-1].message == "completed local engine worker; delivery pending"
    assert events[-1].artifact_ref == result.run.result_ref


def test_local_engine_marks_run_failed_when_harness_fails(
    tmp_path: Path,
    isolated_home: Path,
):
    repo_path = tmp_path / "repo"
    sources_path = tmp_path / "sources"
    repo_path.mkdir()
    sources_path.mkdir()
    fake_harness = FakeHarnessAdapter(
        HarnessRunResult(
            kind=HarnessKind.CODEX,
            status=HarnessRunStatus.FAILED,
            output_text="model exploded",
            summary="model exploded",
        )
    )
    app, run = local_engine_app(
        isolated_home,
        fake_harness,
        repo_path,
        sources_path,
    )

    result = app.workflows.local_engine.execute(
        ExecuteLocalEngineRunRequest(run_id=run.id)
    )
    events = app.control.list_run_events(ListControlRunEventsRequest(run_id=run.id))

    assert result.executed is False
    assert result.reason == "engine_failed"
    assert result.run.status is ControlRunStatus.FAILED
    assert result.run.result_ref is not None
    assert result.engine is not None
    assert result.engine.status is EngineRunStatus.FAILED
    assert result.engine.error == (
        "harness codex failed with status failed: model exploded"
    )
    assert tuple(event.kind for event in events) == (
        ControlRunEventKind.STATUS,
        ControlRunEventKind.OUTPUT,
        ControlRunEventKind.ERROR,
    )
    assert events[-1].artifact_ref == result.run.result_ref


def test_local_engine_marks_run_failed_without_prepared_request(
    tmp_path: Path,
    isolated_home: Path,
):
    fake_harness = FakeHarnessAdapter(
        HarnessRunResult(
            kind=HarnessKind.CODEX,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="unused",
        )
    )
    repo_path = tmp_path / "repo"
    repo_path.mkdir()
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
        ),
        harness_adapters=(fake_harness,),
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo_path,
        )
    )
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    run = app.control.create_run(
        CreateControlRunRequest(
            repository_id=repository.id,
            branch_id=branch.id,
            expected_head_sha="head-1",
        )
    )

    result = app.workflows.local_engine.execute(
        ExecuteLocalEngineRunRequest(run_id=run.id)
    )
    events = app.control.list_run_events(ListControlRunEventsRequest(run_id=run.id))

    assert result.executed is False
    assert result.run.status is ControlRunStatus.FAILED
    assert result.engine is None
    assert fake_harness.requests == []
    assert tuple(event.kind for event in events) == (ControlRunEventKind.ERROR,)
    assert events[0].message == f"engine run request not found: {run.id}"


def local_engine_app(
    isolated_home: Path,
    fake_harness: FakeHarnessAdapter,
    repo_path: Path,
    sources_path: Path,
):
    write_minimal_wiki(repo_path)
    app = create_app(
        AppConfig(
            registry_path=isolated_home / ".codealmanac/registry.json",
            control_db_path=isolated_home / ".codealmanac/control.sqlite",
            run_artifacts_path=isolated_home / ".codealmanac/runs",
        ),
        harness_adapters=(fake_harness,),
    )
    repository = app.control.upsert_repository(
        UpsertRepositoryRequest(
            provider="github",
            owner_login="AlmanacCode",
            name="codealmanac",
            full_name="AlmanacCode/codealmanac",
            almanac_root=Path("almanac"),
            local_root_path=repo_path,
        )
    )
    branch = app.control.set_branch_policy(
        SetBranchPolicyRequest(repository_id=repository.id, name="dev")
    )
    run = app.control.create_run(
        CreateControlRunRequest(
            repository_id=repository.id,
            branch_id=branch.id,
            expected_head_sha="head-1",
        )
    )
    app.engine.runs.prepare(
        PrepareEngineRunRequest(
            run_id=run.id,
            repository_id=repository.id,
            branch_id=branch.id,
            repository_full_name=repository.full_name,
            branch_name=branch.name,
            expected_head_sha="head-1",
            repo_path=repo_path,
            almanac_root=repository.almanac_root,
            sources_path=sources_path,
        )
    )
    return app, run


def write_minimal_wiki(repo_path: Path) -> None:
    (repo_path / "almanac/pages").mkdir(parents=True, exist_ok=True)
    (repo_path / "almanac/topics.yaml").write_text(
        "topics: []\n",
        encoding="utf-8",
    )

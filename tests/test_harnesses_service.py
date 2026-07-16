from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.core.errors import ConflictError, NotFoundError
from codealmanac.services.harnesses.models import (
    HarnessAgentKind,
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.harnesses.service import (
    HarnessesService,
    HarnessUnavailable,
)


class FakeHarnessAdapter:
    def __init__(self, kind: HarnessKind):
        self.kind = kind
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=True,
            message=f"{self.kind.value} ready",
        )

    def run(self, request: RunHarnessRequest, on_event=None) -> HarnessRunResult:
        self.requests.append(request)
        return HarnessRunResult(
            kind=self.kind,
            status=HarnessRunStatus.SUCCEEDED,
            output_text="updated wiki",
            summary=request.title,
            changed_files=(request.cwd / "almanac/example.md",),
        )


def test_harnesses_service_runs_registered_adapter(tmp_path: Path):
    adapter = FakeHarnessAdapter(HarnessKind.CODEX)
    service = HarnessesService((adapter,))

    result = service.run(
        RunHarnessRequest(
            kind=HarnessKind.CODEX,
            model="gpt-5.5",
            agent=HarnessAgentKind.INGEST,
            cwd=tmp_path,
            prompt="Update the wiki from these source briefs.",
            title="Ingest source brief",
        )
    )

    assert result.kind == HarnessKind.CODEX
    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.changed_files == (tmp_path / "almanac/example.md",)
    assert adapter.requests[0].prompt == "Update the wiki from these source briefs."


class UnavailableHarnessAdapter:
    def __init__(self, kind: HarnessKind):
        self.kind = kind
        self.requests: list[RunHarnessRequest] = []

    def check(self) -> HarnessReadiness:
        return HarnessReadiness(
            kind=self.kind,
            available=False,
            message="Error: spawn codex ENOENT",
            repair="reinstall with `npm install -g @openai/codex`",
        )

    def run(self, request: RunHarnessRequest, on_event=None) -> HarnessRunResult:
        self.requests.append(request)
        raise AssertionError("an unavailable harness never runs")


def test_harnesses_service_refuses_to_run_unavailable_harness(tmp_path: Path):
    adapter = UnavailableHarnessAdapter(HarnessKind.CODEX)
    service = HarnessesService((adapter, FakeHarnessAdapter(HarnessKind.CLAUDE)))

    with pytest.raises(HarnessUnavailable) as excinfo:
        service.run(
            RunHarnessRequest(
                kind=HarnessKind.CODEX,
                model="gpt-5.5",
                agent=HarnessAgentKind.BUILD,
                cwd=tmp_path,
                prompt="Build the wiki.",
            )
        )

    message = str(excinfo.value)
    assert "harness codex is not available: Error: spawn codex ENOENT" in message
    assert "reinstall with `npm install -g @openai/codex`" in message
    assert "codealmanac config set harness.default claude" in message
    assert adapter.requests == []


def test_harnesses_service_ensure_ready_returns_readiness_when_available():
    service = HarnessesService((FakeHarnessAdapter(HarnessKind.CODEX),))

    readiness = service.ensure_ready(HarnessKind.CODEX)

    assert readiness.available is True
    assert readiness.message == "codex ready"


def test_harnesses_service_ensure_ready_raises_for_unregistered_kind():
    service = HarnessesService((FakeHarnessAdapter(HarnessKind.CODEX),))

    with pytest.raises(NotFoundError):
        service.ensure_ready(HarnessKind.CLAUDE)


def test_unavailable_message_omits_switch_hint_without_alternatives(tmp_path: Path):
    service = HarnessesService((UnavailableHarnessAdapter(HarnessKind.CODEX),))

    with pytest.raises(HarnessUnavailable) as excinfo:
        service.ensure_ready(HarnessKind.CODEX)

    assert "switch harness" not in str(excinfo.value)


def test_harnesses_service_reports_readiness():
    service = HarnessesService(
        (
            FakeHarnessAdapter(HarnessKind.CODEX),
            FakeHarnessAdapter(HarnessKind.CLAUDE),
        )
    )

    checks = service.check()

    assert [check.kind for check in checks] == [HarnessKind.CODEX, HarnessKind.CLAUDE]
    assert all(check.available for check in checks)


def test_harnesses_service_readiness_answers_for_unregistered_kind():
    service = HarnessesService((FakeHarnessAdapter(HarnessKind.CODEX),))

    registered = service.readiness(HarnessKind.CODEX)
    unregistered = service.readiness(HarnessKind.CLAUDE)

    assert registered.available is True
    assert unregistered.available is False
    assert unregistered.message == "no claude harness adapter is registered"


def test_harnesses_service_rejects_missing_or_duplicate_adapters(tmp_path: Path):
    service = HarnessesService()

    with pytest.raises(NotFoundError):
        service.run(
            RunHarnessRequest(
                kind=HarnessKind.CODEX,
                model="gpt-5.5",
                agent=HarnessAgentKind.BUILD,
                cwd=tmp_path,
                prompt="Try a run without an adapter.",
            )
        )

    with pytest.raises(ConflictError):
        HarnessesService(
            (
                FakeHarnessAdapter(HarnessKind.CODEX),
                FakeHarnessAdapter(HarnessKind.CODEX),
            )
        )


def test_run_harness_request_requires_prompt(tmp_path: Path):
    with pytest.raises(ValidationError):
        RunHarnessRequest(kind=HarnessKind.CODEX, cwd=tmp_path, prompt=" ")

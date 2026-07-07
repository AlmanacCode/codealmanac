from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.core.errors import ConflictError, NotFoundError
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.services.harnesses.service import HarnessesService


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

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
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
            cwd=tmp_path,
            prompt="Update the wiki from these source briefs.",
            title="Ingest source brief",
        )
    )

    assert result.kind == HarnessKind.CODEX
    assert result.status == HarnessRunStatus.SUCCEEDED
    assert result.changed_files == (tmp_path / "almanac/example.md",)
    assert adapter.requests[0].prompt == "Update the wiki from these source briefs."


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


def test_harnesses_service_rejects_missing_or_duplicate_adapters(tmp_path: Path):
    service = HarnessesService()

    with pytest.raises(NotFoundError):
        service.run(
            RunHarnessRequest(
                kind=HarnessKind.CODEX,
                model="gpt-5.5",
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

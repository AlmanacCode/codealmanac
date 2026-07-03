from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.integrations.setup.instructions import (
    CLAUDE_IMPORT_LINE,
    CODEALMANAC_END,
    CODEALMANAC_START,
    FileInstructionInstaller,
)
from codealmanac.services.setup.models import SetupTarget
from codealmanac.services.setup.requests import RunSetupRequest, RunUninstallRequest
from codealmanac.services.setup.service import SetupService
from codealmanac.workflows.cloud_login.models import CloudLoginWorkflowResult
from codealmanac.workflows.cloud_login.requests import RunCloudLoginRequest


def test_setup_installs_codex_block_idempotently(home: Path):
    service = setup_service(home)

    first = service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))
    second = service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    agents_path = home / ".codex/AGENTS.md"
    body = agents_path.read_text(encoding="utf-8")
    assert first.changes[0].changed is True
    assert second.changes[0].changed is False
    assert body.count(CODEALMANAC_START) == 1
    assert body.count(CODEALMANAC_END) == 1
    assert "codealmanac search" in body
    assert first.plan.default_harness.value == "codex"
    assert first.plan.instruction_targets == (SetupTarget.CODEX,)
    assert first.plan.next_commands[-1].command == ("codealmanac", "open")


def test_setup_uses_non_empty_codex_override(home: Path):
    override = home / ".codex/AGENTS.override.md"
    override.parent.mkdir(parents=True)
    override.write_text("# existing override\n", encoding="utf-8")

    setup_service(home).run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    assert CODEALMANAC_START in override.read_text(encoding="utf-8")
    assert not (home / ".codex/AGENTS.md").exists()


def test_setup_installs_claude_guide_and_import_idempotently(home: Path):
    service = setup_service(home)

    service.run(RunSetupRequest(targets=(SetupTarget.CLAUDE,)))
    result = service.run(RunSetupRequest(targets=(SetupTarget.CLAUDE,)))

    guide_path = home / ".claude/codealmanac.md"
    claude_md = (home / ".claude/CLAUDE.md").read_text(encoding="utf-8")
    assert result.changes[0].changed is False
    assert "codealmanac search" in guide_path.read_text(encoding="utf-8")
    assert claude_md.count(CLAUDE_IMPORT_LINE) == 1


def test_uninstall_removes_only_setup_owned_codex_content(home: Path):
    agents = home / ".codex/AGENTS.md"
    agents.parent.mkdir(parents=True)
    agents.write_text("# user rules\n", encoding="utf-8")
    service = setup_service(home)
    service.run(RunSetupRequest(targets=(SetupTarget.CODEX,)))

    result = service.uninstall(RunUninstallRequest(targets=(SetupTarget.CODEX,)))

    assert result.changes[0].changed is True
    assert agents.read_text(encoding="utf-8") == "# user rules\n"


def test_uninstall_removes_claude_artifacts_and_preserves_user_content(home: Path):
    claude_md = home / ".claude/CLAUDE.md"
    claude_md.parent.mkdir(parents=True)
    claude_md.write_text("# user rules\n", encoding="utf-8")
    service = setup_service(home)
    service.run(RunSetupRequest(targets=(SetupTarget.CLAUDE,)))

    result = service.uninstall(RunUninstallRequest(targets=(SetupTarget.CLAUDE,)))

    assert result.changes[0].changed is True
    assert not (home / ".claude/codealmanac.md").exists()
    assert claude_md.read_text(encoding="utf-8") == "# user rules\n"


def test_empty_target_request_is_rejected():
    with pytest.raises(ValidationError):
        RunSetupRequest(targets=())


def test_setup_skip_instructions_still_returns_plan(home: Path):
    result = setup_service(home).run(RunSetupRequest(skip_instructions=True))

    assert result.skipped_instructions is True
    assert result.changes == ()
    assert result.plan.default_harness.value == "codex"
    assert tuple(target.value for target in result.plan.instruction_targets) == (
        "codex",
        "claude",
    )


def test_setup_rejects_scheduler_fields():
    with pytest.raises(ValidationError):
        RunSetupRequest(install_automation=True)


@pytest.fixture
def home(tmp_path: Path) -> Path:
    return tmp_path / "home"


def setup_service(home: Path) -> SetupService:
    return SetupService(
        FileInstructionInstaller(home),
        FakeSetupCloudLogin(),
    )


class FakeSetupCloudLogin:
    def __init__(self) -> None:
        self.requests: list[RunCloudLoginRequest] = []

    def run(self, request: RunCloudLoginRequest) -> CloudLoginWorkflowResult:
        self.requests.append(request)
        return CloudLoginWorkflowResult(
            api_url=request.api_url,
            status="signed_in",
            github_user_id=10,
            github_login="rohans0509",
        )

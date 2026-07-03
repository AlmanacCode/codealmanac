from enum import StrEnum
from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.workflows.cloud_login.models import CloudLoginWorkflowResult


class SetupTarget(StrEnum):
    CODEX = "codex"
    CLAUDE = "claude"


class InstructionChange(CodeAlmanacModel):
    target: SetupTarget
    changed: bool
    paths: tuple[Path, ...] = ()
    message: str = Field(min_length=1)


class SetupCommand(CodeAlmanacModel):
    label: str
    command: tuple[str, ...]

    @field_validator("label")
    @classmethod
    def require_label(cls, value: str) -> str:
        return required_text(value, "setup command label")

    @field_validator("command")
    @classmethod
    def require_command(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) == 0:
            raise ValueError("setup command is required")
        for item in value:
            required_text(item, "setup command part")
        return value


class SetupPlan(CodeAlmanacModel):
    default_harness: HarnessKind
    instruction_targets: tuple[SetupTarget, ...]
    next_commands: tuple[SetupCommand, ...]

    @field_validator("instruction_targets")
    @classmethod
    def require_instruction_targets(
        cls,
        value: tuple[SetupTarget, ...],
    ) -> tuple[SetupTarget, ...]:
        if len(value) == 0:
            raise ValueError("setup plan instruction targets are required")
        return value


class SetupResult(CodeAlmanacModel):
    plan: SetupPlan
    cloud_login: CloudLoginWorkflowResult | None = None
    skipped_instructions: bool = False
    changes: tuple[InstructionChange, ...] = ()


class UninstallResult(CodeAlmanacModel):
    kept_instructions: bool = False
    changes: tuple[InstructionChange, ...] = ()

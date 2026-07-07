from enum import StrEnum
from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.automation.models import (
    AutomationInstallResult,
    AutomationTask,
    AutomationUninstallResult,
)
from codealmanac.services.config.models import ConfigSetResult
from codealmanac.services.harnesses.models import HarnessKind, HarnessReadiness
from codealmanac.services.updates.models import UpdateInstallMethod


class SetupTarget(StrEnum):
    CODEX = "codex"
    CLAUDE = "claude"


class SetupAutomationMode(StrEnum):
    RECOMMEND = "recommend"
    INSTALL = "install"


class PackageUninstallStatus(StrEnum):
    REMOVED = "removed"
    SKIPPED = "skipped"
    FAILED = "failed"


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


class SetupAutomationRecommendation(CodeAlmanacModel):
    task: AutomationTask
    description: str
    command: tuple[str, ...]

    @field_validator("description")
    @classmethod
    def require_description(cls, value: str) -> str:
        return required_text(value, "setup automation description")

    @field_validator("command")
    @classmethod
    def require_command(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) == 0:
            raise ValueError("setup automation command is required")
        for item in value:
            required_text(item, "setup automation command part")
        return value


class SetupPlan(CodeAlmanacModel):
    default_harness: HarnessKind
    harness_model: str
    instruction_targets: tuple[SetupTarget, ...]
    auto_commit: bool = True
    automation_mode: SetupAutomationMode = SetupAutomationMode.RECOMMEND
    automation: tuple[SetupAutomationRecommendation, ...]
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
    skipped_instructions: bool = False
    changes: tuple[InstructionChange, ...] = ()
    config_update: ConfigSetResult | None = None
    config_updates: tuple[ConfigSetResult, ...] = ()
    automation_install: AutomationInstallResult | None = None
    runner_readiness: HarnessReadiness | None = None


class GlobalStateRemovalResult(CodeAlmanacModel):
    path: Path
    removed: bool
    message: str = Field(min_length=1)


class PackageUninstallResult(CodeAlmanacModel):
    status: PackageUninstallStatus
    method: UpdateInstallMethod
    command: tuple[str, ...] = ()
    exit_code: int | None = None
    stdout: str = ""
    stderr: str = ""
    message: str = Field(min_length=1)

    @field_validator("command")
    @classmethod
    def require_command_parts(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        for part in value:
            required_text(part, "package uninstall command part")
        return value


class UninstallResult(CodeAlmanacModel):
    changes: tuple[InstructionChange, ...] = ()
    automation_uninstall: AutomationUninstallResult | None = None
    global_state: GlobalStateRemovalResult | None = None
    package_uninstall: PackageUninstallResult | None = None

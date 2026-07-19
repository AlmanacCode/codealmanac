from pathlib import Path

from codealmanac.core.paths import home_dir
from codealmanac.integrations.setup import claude, codex, managed_blocks, opencode
from codealmanac.integrations.setup.guide import read_agent_guide
from codealmanac.services.setup.models import InstructionChange, SetupTarget

CLAUDE_IMPORT_LINE = claude.CLAUDE_IMPORT_LINE
CODEALMANAC_END = managed_blocks.CODEALMANAC_END
CODEALMANAC_START = managed_blocks.CODEALMANAC_START

__all__ = [
    "CLAUDE_IMPORT_LINE",
    "CODEALMANAC_END",
    "CODEALMANAC_START",
    "FileInstructionInstaller",
]


class FileInstructionInstaller:
    def __init__(self, home: Path | None = None):
        self._home = home

    def install(
        self,
        targets: tuple[SetupTarget, ...],
    ) -> tuple[InstructionChange, ...]:
        guide = read_agent_guide()
        changes: list[InstructionChange] = []
        for target in targets:
            changes.append(install_target(target, self.home, guide))
        return tuple(changes)

    def uninstall(
        self,
        targets: tuple[SetupTarget, ...],
    ) -> tuple[InstructionChange, ...]:
        changes: list[InstructionChange] = []
        for target in targets:
            changes.append(uninstall_target(target, self.home))
        return tuple(changes)

    @property
    def home(self) -> Path:
        return self._home or home_dir()


def install_target(target: SetupTarget, home: Path, guide: str) -> InstructionChange:
    if target == SetupTarget.CODEX:
        return codex.install_codex_instructions(home, guide)
    if target == SetupTarget.CLAUDE:
        return claude.install_claude_instructions(home, guide)
    if target == SetupTarget.OPENCODE:
        return opencode.install_opencode_instructions(home, guide)
    raise ValueError(f"unsupported setup target: {target.value}")


def uninstall_target(target: SetupTarget, home: Path) -> InstructionChange:
    if target == SetupTarget.CODEX:
        return codex.uninstall_codex_instructions(home)
    if target == SetupTarget.CLAUDE:
        return claude.uninstall_claude_instructions(home)
    if target == SetupTarget.OPENCODE:
        return opencode.uninstall_opencode_instructions(home)
    raise ValueError(f"unsupported setup target: {target.value}")

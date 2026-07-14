from pathlib import Path

from codealmanac.integrations.setup.managed_blocks import (
    format_managed_block,
    remove_managed_block,
    upsert_managed_block,
)
from codealmanac.integrations.setup.text_files import read_text_if_present
from codealmanac.services.setup.models import InstructionChange, SetupTarget

# OpenCode's own global rules file, read across every project — confirmed
# at https://opencode.ai/docs/rules/. Distinct from Codex's ~/.codex/
# AGENTS.md; no evidence OpenCode supports a Codex-style AGENTS.override.md,
# so unlike codex.py this has no override-path resolution.
OPENCODE_AGENTS_PATH = Path(".config") / "opencode" / "AGENTS.md"


def install_opencode_instructions(home: Path, guide: str) -> InstructionChange:
    agents_path = home / OPENCODE_AGENTS_PATH
    agents_path.parent.mkdir(parents=True, exist_ok=True)
    existing = read_text_if_present(agents_path)
    block = format_managed_block(guide)
    next_body = upsert_managed_block(existing, block)
    if next_body == existing:
        return InstructionChange(
            target=SetupTarget.OPENCODE,
            changed=False,
            paths=(agents_path,),
            message="OpenCode instructions already installed",
        )
    agents_path.write_text(next_body, encoding="utf-8")
    return InstructionChange(
        target=SetupTarget.OPENCODE,
        changed=True,
        paths=(agents_path,),
        message="Installed OpenCode AGENTS instructions",
    )


def uninstall_opencode_instructions(home: Path) -> InstructionChange:
    agents_path = home / OPENCODE_AGENTS_PATH
    existing = read_text_if_present(agents_path)
    if existing == "":
        return InstructionChange(
            target=SetupTarget.OPENCODE,
            changed=False,
            paths=(),
            message="OpenCode instructions were not installed",
        )
    removed = remove_managed_block(existing)
    if removed == existing:
        return InstructionChange(
            target=SetupTarget.OPENCODE,
            changed=False,
            paths=(),
            message="OpenCode instructions were not installed",
        )
    if removed.strip() == "":
        agents_path.unlink(missing_ok=True)
    else:
        agents_path.write_text(removed, encoding="utf-8")
    return InstructionChange(
        target=SetupTarget.OPENCODE,
        changed=True,
        paths=(agents_path,),
        message="Removed OpenCode AGENTS instructions",
    )

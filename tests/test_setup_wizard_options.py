from pathlib import Path

import pytest

from codealmanac.cli.dispatch.setup_wizard.options import (
    RUNNER_LABELS,
    TARGET_LABELS,
    model_options,
    parse_setup_targets,
    runner_for_index,
    runner_index,
    target_default_index,
    target_options,
    targets_for_index,
)
from codealmanac.integrations.setup.instructions import FileInstructionInstaller
from codealmanac.integrations.setup.opencode import (
    install_opencode_instructions,
    uninstall_opencode_instructions,
)
from codealmanac.services.config.models import HARNESS_MODELS
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.setup.models import SetupTarget

GUIDE = "Follow the codealmanac agent guide."


# --- runner index round trip -----------------------------------------------


@pytest.mark.parametrize(
    ("harness", "index"),
    [
        (HarnessKind.CODEX, 0),
        (HarnessKind.CLAUDE, 1),
        (HarnessKind.OPENCODE, 2),
    ],
)
def test_runner_index_round_trip(harness, index):
    assert runner_index(harness) == index
    assert runner_for_index(index) == harness


def test_runner_for_index_falls_back_to_codex_out_of_range():
    assert runner_for_index(99) == HarnessKind.CODEX
    assert runner_for_index(-1) == HarnessKind.CODEX


def test_runner_labels_cover_every_harness_kind():
    assert set(RUNNER_LABELS) == set(HarnessKind)


# --- model options ------------------------------------------------------


@pytest.mark.parametrize("harness", list(HarnessKind))
def test_model_options_has_a_label_and_detail_for_every_curated_model(harness):
    options = model_options(harness)

    assert len(options) == len(HARNESS_MODELS[harness])
    assert all(option.description for option in options)


# --- target index round trip ------------------------------------------------


def test_target_options_offers_all_plus_one_per_target():
    options = target_options()

    assert len(options) == 4
    assert options[0].label == "Codex + Claude + OpenCode"
    assert [option.label for option in options[1:]] == [
        "Codex only",
        "Claude only",
        "OpenCode only",
    ]


@pytest.mark.parametrize(
    ("index", "targets"),
    [
        (0, (SetupTarget.CODEX, SetupTarget.CLAUDE, SetupTarget.OPENCODE)),
        (1, (SetupTarget.CODEX,)),
        (2, (SetupTarget.CLAUDE,)),
        (3, (SetupTarget.OPENCODE,)),
    ],
)
def test_targets_for_index_and_default_index_round_trip(index, targets):
    assert targets_for_index(index) == targets
    assert target_default_index(targets) == index


def test_target_labels_cover_every_setup_target():
    assert set(TARGET_LABELS) == set(SetupTarget)


# --- parse_setup_targets -----------------------------------------------------


def test_parse_setup_targets_all_includes_opencode():
    assert parse_setup_targets("all") == (
        SetupTarget.CODEX,
        SetupTarget.CLAUDE,
        SetupTarget.OPENCODE,
    )


def test_parse_setup_targets_single_target():
    assert parse_setup_targets("opencode") == (SetupTarget.OPENCODE,)


# --- install_opencode_instructions / uninstall ------------------------------


def test_install_opencode_instructions_writes_managed_block(tmp_path: Path):
    change = install_opencode_instructions(tmp_path, GUIDE)

    agents_path = tmp_path / ".config" / "opencode" / "AGENTS.md"
    assert change.changed is True
    assert change.target == SetupTarget.OPENCODE
    assert change.paths == (agents_path,)
    assert agents_path.is_file()
    assert GUIDE in agents_path.read_text(encoding="utf-8")


def test_install_opencode_instructions_is_idempotent(tmp_path: Path):
    install_opencode_instructions(tmp_path, GUIDE)

    second = install_opencode_instructions(tmp_path, GUIDE)

    assert second.changed is False
    assert second.message == "OpenCode instructions already installed"


def test_uninstall_opencode_instructions_removes_managed_block(tmp_path: Path):
    install_opencode_instructions(tmp_path, GUIDE)

    change = uninstall_opencode_instructions(tmp_path)

    agents_path = tmp_path / ".config" / "opencode" / "AGENTS.md"
    assert change.changed is True
    assert not agents_path.exists()


def test_uninstall_opencode_instructions_is_a_noop_when_never_installed(
    tmp_path: Path,
):
    change = uninstall_opencode_instructions(tmp_path)

    assert change.changed is False
    assert change.message == "OpenCode instructions were not installed"


def test_uninstall_opencode_instructions_preserves_unrelated_content(
    tmp_path: Path,
):
    agents_path = tmp_path / ".config" / "opencode" / "AGENTS.md"
    agents_path.parent.mkdir(parents=True)
    agents_path.write_text("# my own notes\n", encoding="utf-8")

    change = uninstall_opencode_instructions(tmp_path)

    assert change.changed is False
    assert agents_path.read_text(encoding="utf-8") == "# my own notes\n"


# --- FileInstructionInstaller -----------------------------------------------


def test_file_instruction_installer_covers_opencode_target(tmp_path: Path):
    installer = FileInstructionInstaller(home=tmp_path)

    changes = installer.install((SetupTarget.OPENCODE,))

    assert len(changes) == 1
    assert changes[0].target == SetupTarget.OPENCODE
    assert changes[0].changed is True

    uninstalled = installer.uninstall((SetupTarget.OPENCODE,))

    assert uninstalled[0].changed is True

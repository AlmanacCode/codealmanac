from codealmanac.cli.render.setup import SetupChoiceOption, SetupChoiceScreen
from codealmanac.services.setup.models import SetupTarget


def target_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption(
            "Codex + Claude",
            (),
            ("b",),
        ),
        SetupChoiceOption(
            "Codex only",
            (),
            ("c",),
        ),
        SetupChoiceOption(
            "Claude only",
            (),
            ("l",),
        ),
    )


def maintenance_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption("Automatic", ()),
        SetupChoiceOption("Manual", ()),
    )


def update_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption("Automatic", ()),
        SetupChoiceOption("Manual", ()),
    )


def change_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption("Commit changes", ()),
        SetupChoiceOption("Leave in worktree", ()),
    )


def shortcut_option_index(screen: SetupChoiceScreen, key: str) -> int | None:
    normalized = key.casefold()
    for index, option in enumerate(screen.options):
        if normalized in option.shortcuts:
            return index
    return None


def target_default_index(targets: tuple[SetupTarget, ...]) -> int:
    if targets == (SetupTarget.CODEX,):
        return 1
    if targets == (SetupTarget.CLAUDE,):
        return 2
    return 0


def targets_for_index(index: int) -> tuple[SetupTarget, ...]:
    if index == 1:
        return (SetupTarget.CODEX,)
    if index == 2:
        return (SetupTarget.CLAUDE,)
    return (SetupTarget.CODEX, SetupTarget.CLAUDE)


def parse_setup_targets(value: str) -> tuple[SetupTarget, ...]:
    if value == "all":
        return (SetupTarget.CODEX, SetupTarget.CLAUDE)
    return (SetupTarget(value),)

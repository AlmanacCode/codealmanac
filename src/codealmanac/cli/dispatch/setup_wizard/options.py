from codealmanac.cli.render.setup import SetupChoiceOption, SetupChoiceScreen
from codealmanac.services.config.models import HARNESS_MODELS
from codealmanac.services.harnesses.models import HarnessKind
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


def runner_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption("Codex", ("runs CodeAlmanac jobs",), ("c",)),
        SetupChoiceOption("Claude", ("runs CodeAlmanac jobs",), ("l",)),
    )


def model_options(harness: HarnessKind) -> tuple[SetupChoiceOption, ...]:
    return tuple(
        SetupChoiceOption(
            MODEL_LABELS[model],
            (MODEL_DETAILS[model],),
        )
        for model in HARNESS_MODELS[harness]
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


def runner_for_index(index: int) -> HarnessKind:
    if index == 1:
        return HarnessKind.CLAUDE
    return HarnessKind.CODEX


def runner_index(harness: HarnessKind) -> int:
    if harness == HarnessKind.CLAUDE:
        return 1
    return 0


def model_for_index(harness: HarnessKind, index: int) -> str:
    models = HARNESS_MODELS[harness]
    return models[index] if index < len(models) else models[0]


def model_index(harness: HarnessKind, model: str) -> int:
    models = HARNESS_MODELS[harness]
    return models.index(model) if model in models else 0


def parse_setup_targets(value: str) -> tuple[SetupTarget, ...]:
    if value == "all":
        return (SetupTarget.CODEX, SetupTarget.CLAUDE)
    return (SetupTarget(value),)


MODEL_LABELS = {
    "gpt-5.5": "GPT-5.5",
    "gpt-5.4": "GPT-5.4",
    "gpt-5.4-mini": "GPT-5.4-Mini",
    "gpt-5.3-codex-spark": "GPT-5.3-Codex-Spark",
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "claude-opus-4-7": "Claude Opus 4.7",
    "claude-haiku-4-5": "Claude Haiku 4.5",
}
MODEL_DETAILS = {
    "gpt-5.5": "recommended wiki-writing runner",
    "gpt-5.4": "strong general runner",
    "gpt-5.4-mini": "faster routine maintenance",
    "gpt-5.3-codex-spark": "lightweight small updates",
    "claude-sonnet-4-6": "recommended maintenance runner",
    "claude-opus-4-7": "deep rebuilds and hard gardens",
    "claude-haiku-4-5": "small routine updates",
}

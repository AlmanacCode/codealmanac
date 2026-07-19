from codealmanac.cli.render.setup import SetupChoiceOption, SetupChoiceScreen
from codealmanac.integrations.harnesses.opencode.models import models_for_selection
from codealmanac.services.config.models import HARNESS_MODELS
from codealmanac.services.harnesses.models import HarnessKind, HarnessReadiness
from codealmanac.services.setup.models import SetupTarget


def target_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption(
            "All runners",
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
        SetupChoiceOption(
            "OpenCode only",
            (),
            ("o",),
        ),
    )


def maintenance_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption(
            "Automatic",
            (
                "Sync learns from recent sessions",
                "Garden improves your wiki",
                "Both run locally in background",
            ),
        ),
        SetupChoiceOption("Manual", ("Run Sync or Garden yourself",)),
    )


def runner_options(
    readiness: tuple[HarnessReadiness, ...] = (),
) -> tuple[SetupChoiceOption, ...]:
    by_kind = {item.kind: item for item in readiness}
    return (
        runner_option(HarnessKind.CODEX, by_kind.get(HarnessKind.CODEX), ("c",)),
        runner_option(HarnessKind.CLAUDE, by_kind.get(HarnessKind.CLAUDE), ("l",)),
        runner_option(
            HarnessKind.OPENCODE,
            by_kind.get(HarnessKind.OPENCODE),
            ("o",),
        ),
    )


def runner_option(
    kind: HarnessKind,
    readiness: HarnessReadiness | None,
    shortcuts: tuple[str, ...],
) -> SetupChoiceOption:
    label = RUNNER_LABELS[kind]
    if readiness is None:
        return SetupChoiceOption(label, ("checking status in setup",), shortcuts)
    if readiness.available:
        return SetupChoiceOption(
            label,
            ("ready", readiness.message),
            shortcuts,
        )
    details = ("not configured", readiness.repair or readiness.message)
    return SetupChoiceOption(label, details, shortcuts, disabled=True)


def model_options(harness: HarnessKind) -> tuple[SetupChoiceOption, ...]:
    return tuple(
        SetupChoiceOption(
            model_label(model),
            (model_detail(model),),
        )
        for model in models_for_harness(harness)
    )


def models_for_harness(harness: HarnessKind) -> tuple[str, ...]:
    if harness is HarnessKind.OPENCODE:
        return models_for_selection()
    return HARNESS_MODELS[harness]


def model_label(model: str) -> str:
    return MODEL_LABELS.get(model, model)


def model_detail(model: str) -> str:
    if model in MODEL_DETAILS:
        return MODEL_DETAILS[model]
    provider, separator, name = model.partition("/")
    if separator and name:
        return f"OpenCode · {provider}"
    return "OpenCode model"


def update_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption(
            "Automatic",
            (
                "Keep CodeAlmanac updated",
                "Runs locally in background",
            ),
        ),
        SetupChoiceOption(
            "Manual",
            ("Run codealmanac update yourself",),
        ),
    )


def change_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption("Commit changes", ()),
        SetupChoiceOption("Leave in worktree", ()),
    )


def telemetry_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption(
            "Yes, help improve CodeAlmanac",
            (
                "Recommended",
                "Anonymous usage and crash reports",
                "Never code, prompts, or transcripts",
            ),
        ),
        SetupChoiceOption(
            "No thanks",
            (
                "Do not share usage or crashes",
                "You can change this later",
            ),
        ),
    )


def shortcut_option_index(screen: SetupChoiceScreen, key: str) -> int | None:
    normalized = key.casefold()
    for index, option in enumerate(screen.options):
        if option.disabled:
            continue
        if normalized in option.shortcuts:
            return index
    return None


def target_default_index(targets: tuple[SetupTarget, ...]) -> int:
    if targets == (SetupTarget.CODEX,):
        return 1
    if targets == (SetupTarget.CLAUDE,):
        return 2
    if targets == (SetupTarget.OPENCODE,):
        return 3
    return 0


def targets_for_index(index: int) -> tuple[SetupTarget, ...]:
    if index == 1:
        return (SetupTarget.CODEX,)
    if index == 2:
        return (SetupTarget.CLAUDE,)
    if index == 3:
        return (SetupTarget.OPENCODE,)
    return (SetupTarget.CODEX, SetupTarget.CLAUDE, SetupTarget.OPENCODE)


def runner_for_index(index: int) -> HarnessKind:
    if index == 1:
        return HarnessKind.CLAUDE
    if index == 2:
        return HarnessKind.OPENCODE
    return HarnessKind.CODEX


def runner_index(harness: HarnessKind) -> int:
    if harness == HarnessKind.CLAUDE:
        return 1
    if harness == HarnessKind.OPENCODE:
        return 2
    return 0


def model_for_index(harness: HarnessKind, index: int) -> str:
    models = models_for_harness(harness)
    return models[index] if index < len(models) else models[0]


def model_index(harness: HarnessKind, model: str) -> int:
    models = models_for_harness(harness)
    return models.index(model) if model in models else 0


def parse_setup_targets(value: str) -> tuple[SetupTarget, ...]:
    if value == "all":
        return (SetupTarget.CODEX, SetupTarget.CLAUDE, SetupTarget.OPENCODE)
    return (SetupTarget(value),)


MODEL_LABELS = {
    "gpt-5.5": "GPT-5.5",
    "gpt-5.4": "GPT-5.4",
    "gpt-5.4-mini": "GPT-5.4-Mini",
    "gpt-5.3-codex-spark": "GPT-5.3-Codex-Spark",
    "claude-sonnet-5": "Claude Sonnet 5",
    "claude-opus-4-7": "Claude Opus 4.7",
    "claude-haiku-4-5": "Claude Haiku 4.5",
    "opencode/big-pickle": "OpenCode Big Pickle",
}
RUNNER_LABELS = {
    HarnessKind.CODEX: "Codex",
    HarnessKind.CLAUDE: "Claude",
    HarnessKind.OPENCODE: "OpenCode",
}
TARGET_LABELS = {
    SetupTarget.CODEX: "Codex",
    SetupTarget.CLAUDE: "Claude",
    SetupTarget.OPENCODE: "OpenCode",
}
MODEL_DETAILS = {
    "gpt-5.5": "recommended wiki-writing runner",
    "gpt-5.4": "strong general runner",
    "gpt-5.4-mini": "faster routine maintenance",
    "gpt-5.3-codex-spark": "lightweight small updates",
    "claude-sonnet-5": "recommended maintenance runner",
    "claude-opus-4-7": "deep rebuilds and hard gardens",
    "claude-haiku-4-5": "small routine updates",
    "opencode/big-pickle": "free default OpenCode model",
}

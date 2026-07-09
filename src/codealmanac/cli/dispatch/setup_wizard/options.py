from codealmanac.cli.render.setup import SetupChoiceOption, SetupChoiceScreen
from codealmanac.services.config.models import HARNESS_MODELS
from codealmanac.services.harnesses.models import HarnessKind, HarnessReadiness
from codealmanac.services.setup.models import SetupTarget

# Derived from the enums themselves, not hand-listed, so a future harness is
# a one-line addition to HarnessKind/SetupTarget rather than a second place
# to keep in sync with it. Index 0 is the default/fallback.
HARNESS_ORDER: tuple[HarnessKind, ...] = tuple(HarnessKind)
TARGET_ORDER: tuple[SetupTarget, ...] = tuple(SetupTarget)
# SetupTarget and HarnessKind share the same string values ("codex", etc.),
# so one shortcut map keyed by .value serves both option lists.
SHORTCUTS: dict[str, tuple[str, ...]] = {
    "codex": ("c",),
    "claude": ("l",),
    "opencode": ("o",),
}


def target_options() -> tuple[SetupChoiceOption, ...]:
    combined_label = " + ".join(TARGET_LABELS[target] for target in TARGET_ORDER)
    return (
        SetupChoiceOption(combined_label, (), ("b",)),
        *(
            SetupChoiceOption(
                f"{TARGET_LABELS[target]} only",
                (),
                SHORTCUTS[target.value],
            )
            for target in TARGET_ORDER
        ),
    )


def maintenance_options() -> tuple[SetupChoiceOption, ...]:
    return (
        SetupChoiceOption("Automatic", ()),
        SetupChoiceOption("Manual", ()),
    )


def runner_options(
    readiness: tuple[HarnessReadiness, ...] = (),
) -> tuple[SetupChoiceOption, ...]:
    by_kind = {item.kind: item for item in readiness}
    return tuple(
        runner_option(kind, by_kind.get(kind), SHORTCUTS[kind.value])
        for kind in HARNESS_ORDER
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
        if option.disabled:
            continue
        if normalized in option.shortcuts:
            return index
    return None


def target_default_index(targets: tuple[SetupTarget, ...]) -> int:
    for position, target in enumerate(TARGET_ORDER, start=1):
        if targets == (target,):
            return position
    return 0


def targets_for_index(index: int) -> tuple[SetupTarget, ...]:
    if 1 <= index <= len(TARGET_ORDER):
        return (TARGET_ORDER[index - 1],)
    return TARGET_ORDER


def runner_for_index(index: int) -> HarnessKind:
    if 0 <= index < len(HARNESS_ORDER):
        return HARNESS_ORDER[index]
    return HARNESS_ORDER[0]


def runner_index(harness: HarnessKind) -> int:
    if harness in HARNESS_ORDER:
        return HARNESS_ORDER.index(harness)
    return 0


def model_for_index(harness: HarnessKind, index: int) -> str:
    models = HARNESS_MODELS[harness]
    return models[index] if index < len(models) else models[0]


def model_index(harness: HarnessKind, model: str) -> int:
    models = HARNESS_MODELS[harness]
    return models.index(model) if model in models else 0


def parse_setup_targets(value: str) -> tuple[SetupTarget, ...]:
    if value == "all":
        return TARGET_ORDER
    return (SetupTarget(value),)


MODEL_LABELS = {
    "gpt-5.5": "GPT-5.5",
    "gpt-5.4": "GPT-5.4",
    "gpt-5.4-mini": "GPT-5.4-Mini",
    "gpt-5.3-codex-spark": "GPT-5.3-Codex-Spark",
    "claude-sonnet-5": "Claude Sonnet 5",
    "claude-opus-4-7": "Claude Opus 4.7",
    "claude-haiku-4-5": "Claude Haiku 4.5",
    "opencode/deepseek-v4-flash-free": "OpenCode Zen: DeepSeek v4 Flash (free)",
    "opencode/mimo-v2.5-free": "OpenCode Zen: MiMo v2.5 (free)",
    "opencode/big-pickle": "OpenCode Zen: Big Pickle (free)",
    "openai/gpt-5.5": "GPT-5.5 via OpenAI",
    "openai/gpt-5.4": "GPT-5.4 via OpenAI",
    "openai/gpt-5.4-mini": "GPT-5.4-Mini via OpenAI",
    "openai/gpt-5.3-codex-spark": "GPT-5.3-Codex-Spark via OpenAI",
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
    # deepseek-v4-flash-free is the only opencode model run end-to-end in
    # the Slice 1 spike; the other two are confirmed-registered but
    # unverified for a full generation — see services/config/models.py.
    "opencode/deepseek-v4-flash-free": "recommended opencode runner",
    "opencode/mimo-v2.5-free": "alternate free-tier runner",
    "opencode/big-pickle": "alternate free-tier runner",
    # Routed through the same authenticated OpenAI account Codex uses
    # directly — see the HARNESS_MODELS[OPENCODE] comment in
    # services/config/models.py for what's actually been re-verified
    # through OpenCode versus inherited from Codex's catalog.
    "openai/gpt-5.5": "confirmed live through opencode, full-quality runner",
    "openai/gpt-5.4": "strong general runner",
    "openai/gpt-5.4-mini": "faster routine maintenance",
    "openai/gpt-5.3-codex-spark": "lightweight small updates",
}

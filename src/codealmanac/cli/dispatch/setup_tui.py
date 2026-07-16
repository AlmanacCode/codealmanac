import argparse

from codealmanac.cli.dispatch.setup_wizard.models import (
    SetupCancelled,
    SetupSelections,
)
from codealmanac.cli.dispatch.setup_wizard.options import (
    change_options,
    maintenance_options,
    model_for_index,
    model_index,
    model_options,
    parse_setup_targets,
    runner_for_index,
    runner_index,
    runner_options,
    shortcut_option_index,
    target_default_index,
    target_options,
    targets_for_index,
    telemetry_options,
    update_options,
)
from codealmanac.cli.dispatch.setup_wizard.terminal import (
    read_setup_key,
    supports_interactive_setup,
    wizard_terminal,
)
from codealmanac.cli.render.setup import (
    SetupChoiceScreen,
    background_item_selection_notices,
    render_setup_choice_screen,
)
from codealmanac.services.config.models import (
    DEFAULT_HARNESS_MODELS,
    UserConfig,
)
from codealmanac.services.harnesses.models import HarnessKind, HarnessReadiness


def resolve_setup_selections(
    args: argparse.Namespace,
    user_config: UserConfig,
    runner_status: tuple[HarnessReadiness, ...] = (),
) -> SetupSelections:
    defaults = default_setup_selections(args, user_config)
    if args.yes or args.json or not supports_interactive_setup():
        return defaults
    return interactive_setup_selections(defaults, runner_status)


def default_setup_selections(
    args: argparse.Namespace,
    user_config: UserConfig,
) -> SetupSelections:
    harness = (
        user_config.harness.default if args.runner is None else HarnessKind(args.runner)
    )
    model = (
        user_config.harness.model
        if harness == user_config.harness.default
        else DEFAULT_HARNESS_MODELS[harness]
    )
    return SetupSelections(
        targets=parse_setup_targets(args.target),
        harness=harness,
        model=model,
        auto_update=user_config.automation.update.enabled and not args.no_auto_update,
        auto_commit=user_config.auto_commit and not args.no_auto_commit,
        telemetry_enabled=user_config.telemetry.enabled and not args.no_telemetry,
        sync_off=args.sync_off or not user_config.automation.sync.enabled,
        garden_off=args.garden_off or not user_config.automation.garden.enabled,
    )


def interactive_setup_selections(
    defaults: SetupSelections,
    runner_status: tuple[HarnessReadiness, ...],
) -> SetupSelections:
    try:
        with wizard_terminal():
            return wizard_selections(defaults, runner_status)
    except KeyboardInterrupt as error:
        raise SetupCancelled() from error


def wizard_selections(
    defaults: SetupSelections,
    runner_status: tuple[HarnessReadiness, ...],
) -> SetupSelections:
    runner_index_value = choose_setup_option(
        SetupChoiceScreen(
            step=1,
            title="AI runner",
            question="Which agent should run CodeAlmanac jobs?",
            options=runner_options(runner_status),
        ),
        initial_index=runner_index(defaults.harness),
    )
    harness = runner_for_index(runner_index_value)
    model_index_value = choose_setup_option(
        SetupChoiceScreen(
            step=2,
            title="Runner model",
            question=f"Which {harness.value} model should maintain your wiki?",
            options=model_options(harness),
            visual="list",
        ),
        initial_index=model_index(harness, defaults.model),
    )
    target_index = choose_setup_option(
        SetupChoiceScreen(
            step=3,
            title="Agent instructions",
            question="Add CodeAlmanac instructions to your AGENTS.md / CLAUDE.md:",
            options=target_options(),
        ),
        initial_index=target_default_index(defaults.targets),
    )
    maintenance_index = choose_setup_option(
        SetupChoiceScreen(
            step=4,
            title="Wiki maintenance",
            question="How should your wikis be updated?",
            options=maintenance_options(),
        ),
        initial_index=1 if defaults.sync_off and defaults.garden_off else 0,
    )
    update_index = choose_setup_option(
        SetupChoiceScreen(
            step=5,
            title="Product updates",
            question="Keep CodeAlmanac up to date automatically?",
            options=update_options(),
            selection_notices=background_item_selection_notices(
                automatic_maintenance=maintenance_index == 0
            ),
        ),
        initial_index=0 if defaults.auto_update else 1,
    )
    change_index = choose_setup_option(
        SetupChoiceScreen(
            step=6,
            title="Agent change handling",
            question="Should agents commit wiki changes or leave them in the worktree?",
            options=change_options(),
            visual="change-handling",
        ),
        initial_index=0 if defaults.auto_commit else 1,
    )
    telemetry_index = choose_setup_option(
        SetupChoiceScreen(
            step=7,
            title="Help improve CodeAlmanac",
            question=(
                "Share anonymous usage so we can focus on what matters and fix "
                "broken experiences faster."
            ),
            options=telemetry_options(),
        ),
        initial_index=0 if defaults.telemetry_enabled else 1,
    )
    return SetupSelections(
        targets=targets_for_index(target_index),
        harness=harness,
        model=model_for_index(harness, model_index_value),
        auto_update=update_index == 0,
        auto_commit=change_index == 0,
        telemetry_enabled=telemetry_index == 0,
        sync_off=maintenance_index == 1,
        garden_off=maintenance_index == 1,
    )


def choose_setup_option(screen: SetupChoiceScreen, initial_index: int) -> int:
    selected_index = enabled_index(screen, initial_index)
    render_setup_choice_screen(screen, selected_index)
    while True:
        key = read_setup_key()
        if key in {"\x03", "\x1b", "q"}:
            raise SetupCancelled()
        if key in {"\r", "\n"}:
            if screen.options[selected_index].disabled:
                render_setup_choice_screen(screen, selected_index)
                continue
            return selected_index
        shortcut_index = shortcut_option_index(screen, key)
        if shortcut_index is not None:
            return shortcut_index
        next_index = selected_index
        if key in {"\x1b[D", "a"}:
            next_index = (selected_index - 1) % len(screen.options)
        elif key in {"\x1b[C", "d"}:
            next_index = (selected_index + 1) % len(screen.options)
        elif key in {"\x1b[A", "w"}:
            next_index = (selected_index - 1) % len(screen.options)
        elif key in {"\x1b[B", "s"}:
            next_index = (selected_index + 1) % len(screen.options)
        if next_index != selected_index:
            selected_index = enabled_index(screen, next_index, selected_index)
            render_setup_choice_screen(screen, selected_index)


def enabled_index(
    screen: SetupChoiceScreen,
    index: int,
    fallback: int = 0,
) -> int:
    if len(screen.options) == 0:
        return index
    if not screen.options[index].disabled:
        return index
    for offset in range(1, len(screen.options) + 1):
        candidate = (index + offset) % len(screen.options)
        if not screen.options[candidate].disabled:
            return candidate
    return fallback

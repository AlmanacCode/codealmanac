import argparse

from codealmanac.cli.dispatch.setup_wizard.models import (
    SetupCancelled,
    SetupSelections,
)
from codealmanac.cli.dispatch.setup_wizard.options import (
    change_options,
    maintenance_options,
    parse_setup_targets,
    shortcut_option_index,
    target_default_index,
    target_options,
    targets_for_index,
    update_options,
)
from codealmanac.cli.dispatch.setup_wizard.terminal import (
    read_setup_key,
    supports_interactive_setup,
    wizard_terminal,
)
from codealmanac.cli.render.setup import (
    SetupChoiceScreen,
    render_setup_choice_screen,
)


def resolve_setup_selections(args: argparse.Namespace) -> SetupSelections:
    defaults = default_setup_selections(args)
    if args.yes or args.json or not supports_interactive_setup():
        return defaults
    return interactive_setup_selections(defaults)


def default_setup_selections(args: argparse.Namespace) -> SetupSelections:
    return SetupSelections(
        targets=parse_setup_targets(args.target),
        auto_update=not args.no_auto_update,
        auto_commit=not args.no_auto_commit,
        sync_off=args.sync_off,
        garden_off=args.garden_off,
    )


def interactive_setup_selections(defaults: SetupSelections) -> SetupSelections:
    try:
        with wizard_terminal():
            return wizard_selections(defaults)
    except KeyboardInterrupt as error:
        raise SetupCancelled() from error


def wizard_selections(defaults: SetupSelections) -> SetupSelections:
    target_index = choose_setup_option(
        SetupChoiceScreen(
            step=1,
            title="Agent instructions",
            question="Install CodeAlmanac instructions for:",
            options=target_options(),
        ),
        initial_index=target_default_index(defaults.targets),
    )
    maintenance_index = choose_setup_option(
        SetupChoiceScreen(
            step=2,
            title="Wiki maintenance",
            question="How should your wikis be updated?",
            options=maintenance_options(),
        ),
        initial_index=1 if defaults.sync_off and defaults.garden_off else 0,
    )
    update_index = choose_setup_option(
        SetupChoiceScreen(
            step=3,
            title="Product updates",
            question="Keep CodeAlmanac up to date automatically?",
            options=update_options(),
        ),
        initial_index=0 if defaults.auto_update else 1,
    )
    change_index = choose_setup_option(
        SetupChoiceScreen(
            step=4,
            title="Agent change handling",
            question="Should agents commit wiki changes or leave them in the worktree?",
            options=change_options(),
            visual="change-handling",
        ),
        initial_index=0 if defaults.auto_commit else 1,
    )
    return SetupSelections(
        targets=targets_for_index(target_index),
        auto_update=update_index == 0,
        auto_commit=change_index == 0,
        sync_off=maintenance_index == 1,
        garden_off=maintenance_index == 1,
    )


def choose_setup_option(screen: SetupChoiceScreen, initial_index: int) -> int:
    selected_index = initial_index
    render_setup_choice_screen(screen, selected_index)
    while True:
        key = read_setup_key()
        if key in {"\x03", "\x1b", "q"}:
            raise SetupCancelled()
        if key in {"\r", "\n"}:
            return selected_index
        shortcut_index = shortcut_option_index(screen, key)
        if shortcut_index is not None:
            return shortcut_index
        next_index = selected_index
        if key in {"\x1b[D", "a"}:
            next_index = (selected_index - 1) % len(screen.options)
        elif key in {"\x1b[C", "d"}:
            next_index = (selected_index + 1) % len(screen.options)
        if next_index != selected_index:
            selected_index = next_index
            render_setup_choice_screen(screen, selected_index)

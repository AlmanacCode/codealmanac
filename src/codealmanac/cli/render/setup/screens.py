from dataclasses import dataclass

from codealmanac.cli.render.brand import (
    BAR,
    BLUE,
    BOLD,
    DIM,
    RST,
    WHITE_BOLD,
    option_label,
    print_badge,
    print_banner,
)
from codealmanac.cli.render.setup.background_items import (
    BackgroundItemNotice,
    render_selected_background_item_notice,
)
from codealmanac.cli.render.setup.change_handling import render_change_handling_choice
from codealmanac.cli.render.terminal import (
    card_center_row,
    card_row,
    card_width_for,
    columns_for,
    content_width,
    selected_indicator,
    wrap_text,
    wrap_with_prefixes,
    write_line,
)


@dataclass(frozen=True)
class SetupChoiceOption:
    label: str
    description: tuple[str, ...]
    shortcuts: tuple[str, ...] = ()
    disabled: bool = False


@dataclass(frozen=True)
class SetupChoiceScreen:
    step: int
    title: str
    question: str
    options: tuple[SetupChoiceOption, ...]
    visual: str = "cards"
    total_steps: int = 7
    selection_notices: tuple[BackgroundItemNotice | None, ...] = ()


def render_setup_choice_screen(
    screen: SetupChoiceScreen,
    selected_index: int,
) -> None:
    write_line("\x1b[2J\x1b[H")
    print_banner("The self-updating wiki for your coding agents.")
    print_badge()
    write_line("")
    progress = f"{DIM}[{screen.step}/{screen.total_steps}]{RST}"
    write_line(f"  {BLUE}◆{RST}  {progress} {WHITE_BOLD}{screen.title}{RST}")
    write_line(BAR)
    for line in wrap_with_prefixes(
        screen.question, f"{BAR}   ", f"{BAR}   ", content_width()
    ):
        write_line(line)
    write_line(BAR)
    write_line("")
    if screen.visual == "change-handling":
        render_change_handling_choice(selected_index)
    elif screen.visual == "list":
        render_vertical_options(screen.options, selected_index)
    else:
        render_option_cards(screen.options, selected_index)
    render_selected_background_item_notice(screen.selection_notices, selected_index)
    write_line("")
    write_line(
        f"  {DIM}│{RST}   "
        f"{BLUE}{BOLD}[←/→]{RST} switch   "
        f"{BLUE}{BOLD}[↑/↓]{RST} switch   "
        f"{BLUE}{BOLD}[enter]{RST} choose"
    )
    write_line("")


def render_option_cards(
    options: tuple[SetupChoiceOption, ...],
    selected_index: int,
) -> None:
    available = content_width()
    columns = columns_for(len(options), available)
    card_width = card_width_for(columns, available)
    inner_width = max(1, card_width - 2)
    body_height = max(
        len(wrap_text(option.label, inner_width))
        + sum(len(wrap_text(line, inner_width)) for line in option.description)
        for option in options
    )
    start = 0
    while start < len(options):
        row_options = options[start : start + columns]
        render_option_card_row(
            row_options, start, selected_index, card_width, body_height
        )
        start += columns


def render_option_card_row(
    row_options: tuple[SetupChoiceOption, ...],
    row_start: int,
    selected_index: int,
    card_width: int,
    body_height: int,
) -> None:
    card_lines = tuple(
        option_card(
            option, card_width, row_start + index == selected_index, body_height
        )
        for index, option in enumerate(row_options)
    )
    for row in range(len(card_lines[0])):
        write_line("   " + "   ".join(lines[row] for lines in card_lines))
    indicator_parts = [
        selected_indicator(card_width, f"{BLUE}{BOLD}", RST)
        if row_start + index == selected_index and not option.disabled
        else " " * (card_width + 2)
        for index, option in enumerate(row_options)
    ]
    write_line("   " + "   ".join(indicator_parts))


def render_vertical_options(
    options: tuple[SetupChoiceOption, ...],
    selected_index: int,
) -> None:
    width = min(56, content_width())
    border = BLUE
    write_line(f"   {border}╭{'─' * width}╮{RST}")
    for index, option in enumerate(options):
        selected = index == selected_index
        enabled = not option.disabled
        marker = f"{BLUE}{BOLD}◆{RST}" if selected and enabled else f"{DIM}◇{RST}"
        label = option_label(option.label, selected and enabled)
        if option.disabled:
            label = f"{DIM}{option.label}{RST}"
        write_line(card_row(f" {marker} {label}", width, border, RST))
        for description in option.description:
            body = RST if selected else DIM
            write_line(card_row(f"   {body}{description}{RST}", width, border, RST))
        if index < len(options) - 1:
            write_line(card_row("", width, border, RST))
    write_line(f"   {border}╰{'─' * width}╯{RST}")


def option_card(
    option: SetupChoiceOption,
    width: int,
    selected: bool,
    body_height: int,
) -> tuple[str, ...]:
    enabled = not option.disabled
    border = BLUE if selected and enabled else DIM
    body = RST if selected and enabled else DIM
    label = option_label(option.label, selected and enabled)
    if option.disabled:
        label = f"{DIM}{option.label}{RST}"
    lines = [
        f"{border}╭{'─' * width}╮{RST}",
        card_row("", width, border, RST),
    ]
    for label_line in wrap_text(label, max(1, width - 2)):
        lines.append(card_center_row(label_line, width, border, RST))
    for description in option.description:
        for description_line in wrap_text(description, max(1, width - 2)):
            lines.append(
                card_center_row(f"{body}{description_line}{RST}", width, border, RST)
            )
    while len(lines) - 2 < body_height + 1:
        lines.append(card_row("", width, border, RST))
    lines.append(f"{border}╰{'─' * width}╯{RST}")
    return tuple(lines)

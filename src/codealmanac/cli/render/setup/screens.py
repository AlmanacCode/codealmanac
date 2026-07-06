from dataclasses import dataclass

from codealmanac.cli.render.brand import (
    BAR,
    BLUE,
    BOLD,
    DIFF_GREEN,
    DIFF_RED,
    DIM,
    RST,
    WHITE_BOLD,
    option_label,
    print_badge,
    print_banner,
)
from codealmanac.cli.render.terminal import (
    card_center_row,
    card_right_row,
    card_row,
    wrap_with_prefixes,
    write_line,
)


@dataclass(frozen=True)
class SetupChoiceOption:
    label: str
    description: tuple[str, ...]
    shortcuts: tuple[str, ...] = ()


@dataclass(frozen=True)
class SetupChoiceScreen:
    step: int
    title: str
    question: str
    options: tuple[SetupChoiceOption, ...]
    visual: str = "cards"


def render_setup_choice_screen(
    screen: SetupChoiceScreen,
    selected_index: int,
) -> None:
    write_line("\x1b[2J\x1b[H")
    print_banner("The self-updating wiki for your coding agents.")
    print_badge()
    write_line("")
    write_line(
        f"  {BLUE}◆{RST}  "
        f"{DIM}[{screen.step}/4]{RST} "
        f"{WHITE_BOLD}{screen.title}{RST}"
    )
    write_line(BAR)
    for line in wrap_with_prefixes(screen.question, f"{BAR}   ", f"{BAR}   ", 78):
        write_line(line)
    write_line(BAR)
    write_line("")
    if screen.visual == "change-handling":
        render_change_handling_choice(selected_index)
    else:
        render_option_cards(screen.options, selected_index)
    write_line("")
    write_line(
        f"  {DIM}│{RST}   "
        f"{BLUE}{BOLD}[←/→]{RST} switch   "
        f"{BLUE}{BOLD}[enter]{RST} choose"
    )
    write_line("")


def render_option_cards(
    options: tuple[SetupChoiceOption, ...],
    selected_index: int,
) -> None:
    card_width = 21 if len(options) == 3 else 34
    card_lines = tuple(
        option_card(option, card_width, index == selected_index)
        for index, option in enumerate(options)
    )
    rows = max(len(lines) for lines in card_lines)
    for row in range(rows):
        parts = []
        for lines in card_lines:
            parts.append(lines[row] if row < len(lines) else " " * (card_width + 2))
        write_line("   " + "   ".join(parts))
    indicator_parts = [
        selected_indicator(card_width)
        if index == selected_index
        else " " * (card_width + 2)
        for index in range(len(options))
    ]
    write_line("   " + "   ".join(indicator_parts))


def option_card(
    option: SetupChoiceOption,
    width: int,
    selected: bool,
) -> tuple[str, ...]:
    border = BLUE if selected else DIM
    body = RST if selected else DIM
    lines = [
        f"{border}╭{'─' * width}╮{RST}",
        card_row("", width, border, RST),
        card_center_row(option_label(option.label, selected), width, border, RST),
    ]
    for description in option.description:
        lines.append(card_center_row(f"{body}{description}{RST}", width, border, RST))
    lines.append(card_row("", width, border, RST))
    lines.append(f"{border}╰{'─' * width}╯{RST}")
    return tuple(lines)


def selected_indicator(width: int) -> str:
    text = "◆ selected"
    left_padding = max(0, (width + 2 - len(text)) // 2)
    right_padding = max(0, width + 2 - left_padding - len(text))
    return f"{' ' * left_padding}{BLUE}{BOLD}{text}{RST}{' ' * right_padding}"


def render_change_handling_choice(selected_index: int) -> None:
    width = 34
    cards = (
        change_handling_commit_card(width, selected_index == 0),
        change_handling_worktree_card(width, selected_index == 1),
    )
    rows = max(len(lines) for lines in cards)
    for row in range(rows):
        left = cards[0][row] if row < len(cards[0]) else " " * (width + 2)
        right = cards[1][row] if row < len(cards[1]) else " " * (width + 2)
        write_line(f"   {left}   {right}")
    left_indicator = (
        selected_indicator(width) if selected_index == 0 else " " * (width + 2)
    )
    right_indicator = (
        selected_indicator(width) if selected_index == 1 else " " * (width + 2)
    )
    write_line(f"   {left_indicator}   {right_indicator}")


def change_handling_commit_card(width: int, selected: bool) -> tuple[str, ...]:
    border = BLUE if selected else DIM
    title = WHITE_BOLD if selected else DIM
    muted = RST if selected else DIM
    commit = BLUE if selected else DIM
    return (
        f"{border}╭{'─' * width}╮{RST}",
        card_row("", width, border, RST),
        card_row(f" {title}Commit changes{RST}", width, border, RST),
        card_row("", width, border, RST),
        card_row(f" {commit}● almanac: update wiki context{RST}", width, border, RST),
        card_row(f" {muted}│ rohan · just now{RST}", width, border, RST),
        card_row(f" {muted}│{RST}", width, border, RST),
        card_row(f" {muted}● docs: previous repo commit{RST}", width, border, RST),
        card_row(f" {muted}│ rohan · earlier{RST}", width, border, RST),
        card_row("", width, border, RST),
        card_row("", width, border, RST),
        f"{border}╰{'─' * width}╯{RST}",
    )


def change_handling_worktree_card(width: int, selected: bool) -> tuple[str, ...]:
    border = BLUE if selected else DIM
    title = WHITE_BOLD if selected else DIM
    muted = RST if selected else DIM
    delete = DIFF_RED if selected else DIM
    add = DIFF_GREEN if selected else DIM
    return (
        f"{border}╭{'─' * width}╮{RST}",
        card_row("", width, border, RST),
        card_row(f" {title}Leave in worktree{RST}", width, border, RST),
        card_row("", width, border, RST),
        card_row(f" {muted}almanac/architecture/indexing.md{RST}", width, border, RST),
        card_right_row(f"{delete}-18{RST} {add}+42{RST}", width, border, RST),
        card_row(f" {muted}almanac/decisions/local-first.md{RST}", width, border, RST),
        card_right_row(f"{delete}-4{RST} {add}+19{RST}", width, border, RST),
        card_row(f" {muted}almanac/guides/setup.md{RST}", width, border, RST),
        card_right_row(f"{delete}-2{RST} {add}+11{RST}", width, border, RST),
        card_row("", width, border, RST),
        f"{border}╰{'─' * width}╯{RST}",
    )

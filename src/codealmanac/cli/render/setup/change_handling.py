from codealmanac.cli.render.brand import (
    BLUE,
    BOLD,
    DIFF_GREEN,
    DIFF_RED,
    DIM,
    RST,
    WHITE_BOLD,
)
from codealmanac.cli.render.terminal import (
    card_right_row,
    card_row,
    card_width_for,
    content_width,
    selected_indicator,
    write_line,
)


def render_change_handling_choice(selected_index: int) -> None:
    width = card_width_for(2, content_width())
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
        selected_indicator(width, f"{BLUE}{BOLD}", RST)
        if selected_index == 0
        else " " * (width + 2)
    )
    right_indicator = (
        selected_indicator(width, f"{BLUE}{BOLD}", RST)
        if selected_index == 1
        else " " * (width + 2)
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

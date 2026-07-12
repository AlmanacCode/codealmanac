from codealmanac.cli.render.setup.screens import SetupChoiceOption, option_card
from codealmanac.cli.render.terminal import (
    card_width_for,
    columns_for,
    content_width,
    visible_length,
    wrap_text,
)


def test_card_width_for_matches_known_values() -> None:
    # 2 harnesses -> wide cards, 3 harnesses -> narrower cards, so a row of
    # cards stays close to an 80-column terminal either way.
    assert card_width_for(2, 78) == 34
    assert card_width_for(3, 78) == 21
    assert card_width_for(4, 78) == 14


def test_card_width_for_never_overflows_its_budget_for_real_option_counts() -> None:
    # Regression: the old fixed min_width=18 floor overrode the fitted
    # width whenever a row had enough options (e.g. 4 harnesses), pushing
    # the total row past the 78-column budget and onto the next terminal
    # row — this is the exact corruption seen in the real 80x23 wizard
    # once OpenCode became a 4th runner option (Codex/Claude/OpenCode +
    # "Codex + Claude + OpenCode" in the instruction-target screen). Beyond
    # 4 options card_width_for's floor can still overflow on its own —
    # that's what columns_for exists to protect against (see below).
    for count in range(1, 5):
        width = card_width_for(count, 78)
        assert count * (width + 5) <= 78


def test_columns_for_never_overflows_regardless_of_option_count() -> None:
    for count in range(1, 8):
        for available in (30, 44, 60, 78):
            columns = columns_for(count, available)
            width = card_width_for(columns, available)
            assert columns * (width + 5) <= available


def test_columns_for_wraps_into_a_grid_on_narrow_terminals() -> None:
    # A terminal too narrow for one row of `count` cards should fall back
    # to fewer columns (a multi-row grid) rather than overflow.
    columns = columns_for(4, 44)
    assert columns < 4
    width = card_width_for(columns, 44)
    assert columns * (width + 5) <= 44


def test_columns_for_keeps_single_row_when_it_fits() -> None:
    assert columns_for(4, 78) == 4
    assert columns_for(2, 78) == 2


def test_content_width_stays_within_bounds() -> None:
    width = content_width()
    assert 40 <= width <= 78


def test_wrap_text_splits_long_text_across_lines() -> None:
    lines = wrap_text(
        "opencode providers configured: Cloudflare AI Gateway, OpenAI", 21
    )
    assert len(lines) > 1
    for line in lines:
        assert visible_length(line) <= 21


def test_wrap_text_truncates_a_single_word_longer_than_width() -> None:
    lines = wrap_text("supercalifragilisticexpialidocious", 10)
    assert len(lines) == 1
    assert visible_length(lines[0]) <= 10
    assert lines[0].endswith("…")


def test_option_card_body_does_not_overflow_its_border() -> None:
    # Regression: a long readiness message (e.g. OpenCode's
    # "opencode providers configured: ...") used to overflow past the card's
    # right border because card_center_row never wrapped or truncated
    # content longer than the card width — confirmed visually in the actual
    # interactive wizard once OpenCode became a third runner option.
    option = SetupChoiceOption(
        "OpenCode",
        (
            "ready",
            "opencode providers configured: Cloudflare AI Gateway, OpenAI, "
            "OpenCode Zen",
        ),
    )
    width = card_width_for(3)
    lines = option_card(option, width, selected=True, body_height=0)

    for line in lines:
        assert visible_length(line) == width + 2


def test_option_cards_in_one_row_share_the_same_height() -> None:
    # "Unify card heights": Codex/Claude's short readiness messages and
    # OpenCode's much longer one must still produce equal-height cards, so
    # every card's closing border lands on the same row.
    short_option = SetupChoiceOption("Codex", ("ready", "Logged in using ChatGPT"))
    long_option = SetupChoiceOption(
        "OpenCode",
        (
            "ready",
            "opencode providers configured: Cloudflare AI Gateway, OpenAI, "
            "OpenCode Zen",
        ),
    )
    width = card_width_for(3)
    inner_width = max(1, width - 2)
    body_height = max(
        len(wrap_text(option.label, inner_width))
        + sum(len(wrap_text(line, inner_width)) for line in option.description)
        for option in (short_option, long_option)
    )

    short_lines = option_card(
        short_option, width, selected=False, body_height=body_height
    )
    long_lines = option_card(long_option, width, selected=True, body_height=body_height)

    assert len(short_lines) == len(long_lines)

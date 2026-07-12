from codealmanac.cli.dispatch.setup_wizard.options import RUNNER_LABELS, TARGET_LABELS
from codealmanac.cli.render.brand import BRAND_COLORS, option_label


def test_every_runner_label_has_a_brand_color() -> None:
    # Regression: BRAND_COLORS was a hardcoded {"Codex": ..., "Claude": ...}
    # dict that never gained an "OpenCode" entry when OpenCode was added as
    # a third harness — label_word() silently falls back to no color for
    # any word missing from this dict, so the setup wizard rendered
    # "OpenCode" and "OpenCode only" uncolored while Codex/Claude kept their
    # brand colors. Confirmed visually in the actual interactive wizard.
    for label in RUNNER_LABELS.values():
        assert label in BRAND_COLORS, f"{label!r} has no brand color"


def test_every_target_label_has_a_brand_color() -> None:
    for label in TARGET_LABELS.values():
        assert label in BRAND_COLORS, f"{label!r} has no brand color"


def test_opencode_label_renders_with_its_own_color() -> None:
    rendered = option_label("OpenCode only", selected=False)
    assert BRAND_COLORS["OpenCode"] in rendered
    assert BRAND_COLORS["Codex"] not in rendered
    assert BRAND_COLORS["Claude"] not in rendered

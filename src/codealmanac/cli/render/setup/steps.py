from dataclasses import dataclass

from codealmanac.cli.render.brand import (
    BAR,
    BLUE,
    DIFF_RED,
    DIM,
    RST,
    WHITE_BOLD,
)
from codealmanac.cli.render.terminal import (
    terminal_width,
    wrap_with_prefixes,
    write_line,
)


@dataclass(frozen=True)
class SetupStep:
    label: str
    status: str
    detail: str
    warning: bool = False


def render_setup_step(step: SetupStep) -> None:
    marker = "◇"
    marker_style = BLUE
    label_style = WHITE_BOLD
    status_style = BLUE
    if step.status in {"skipped", "disabled", "off"}:
        marker = "○"
        marker_style = DIM
        label_style = DIM
        status_style = DIM
    if step.warning:
        marker = "▲"
        marker_style = DIFF_RED
        status_style = DIFF_RED
    write_line(
        f"  {marker_style}{marker}{RST}  "
        f"{label_style}{step.label}{RST} "
        f"{status_style}{step.status}{RST}"
    )
    for detail in wrap_step_detail(step.detail):
        write_line(detail)


def wrap_step_detail(detail: str) -> tuple[str, ...]:
    width = max(40, terminal_width() - 6)
    return tuple(wrap_with_prefixes(detail, f"{BAR}   ", f"{BAR}   ", width))

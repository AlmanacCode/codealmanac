"""Shared terminal styling for CLI render modules.

Every constant resolves to the empty string when stdout is not a TTY or
``NO_COLOR`` is set (https://no-color.org/), so the same render function
produces colored output for humans and plain text for pipes without a
second code path. ``--json`` remains the structured piping format.
"""

import os
import re
import sys
from datetime import UTC, datetime, timedelta

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def use_color() -> bool:
    return sys.stdout.isatty() and "NO_COLOR" not in os.environ


def terminal_code(code: str) -> str:
    return code if use_color() else ""


class Palette:
    """Palette resolved per access so tests can toggle TTY/NO_COLOR."""

    @property
    def RST(self) -> str:
        return terminal_code("\x1b[0m")

    @property
    def BOLD(self) -> str:
        return terminal_code("\x1b[1m")

    @property
    def DIM(self) -> str:
        return terminal_code("\x1b[2m")

    @property
    def BLUE(self) -> str:
        return terminal_code("\x1b[38;5;75m")

    @property
    def GREEN(self) -> str:
        return terminal_code("\x1b[38;5;35m")

    @property
    def RED(self) -> str:
        return terminal_code("\x1b[38;5;167m")

    @property
    def YELLOW(self) -> str:
        return terminal_code("\x1b[33m")


style = Palette()

EM_DASH = "—"


def visible_length(value: str) -> int:
    return len(_ANSI_RE.sub("", value))


def pad_visible(value: str, width: int) -> str:
    return value + " " * max(0, width - visible_length(value))


def table(headers: tuple[str, ...], rows: list[tuple[str, ...]]) -> list[str]:
    """Column-aligned text table with ANSI-aware width math."""
    if len(headers) == 0:
        return []
    widths = [
        max(
            [
                visible_length(header),
                *(visible_length(row[index]) for row in rows if index < len(row)),
            ]
        )
        for index, header in enumerate(headers)
    ]
    header_line = table_row(headers, widths)
    if use_color():
        header_line = f"{style.BLUE}{style.BOLD}{header_line}{style.RST}"
    return [header_line, *(table_row(row, widths) for row in rows)]


def table_row(row: tuple[str, ...], widths: list[int]) -> str:
    cells = (
        pad_visible(row[index] if index < len(row) else "", width)
        for index, width in enumerate(widths)
    )
    return "  ".join(cells).rstrip()


def humanize_duration(value: timedelta) -> str:
    """Coarse single-unit duration: 45s, 15m, 2h, 3d."""
    seconds = int(value.total_seconds())
    if seconds < 60:
        return f"{seconds}s"
    minutes = round(seconds / 60)
    if minutes < 60:
        return f"{minutes}m"
    hours = round(minutes / 60)
    if hours < 24:
        return f"{hours}h"
    return f"{round(hours / 24)}d"


def humanize_elapsed(start: datetime, end: datetime | None) -> str:
    finish = end if end is not None else datetime.now(UTC)
    return humanize_duration(finish - start)

import shlex
import sys
from re import sub
from shutil import get_terminal_size

from codealmanac.cli.render.automation import render_automation_uninstall
from codealmanac.cli.render.common import print_json_model
from codealmanac.services.setup.models import (
    InstructionChange,
    SetupResult,
    UninstallResult,
)
from codealmanac.workflows.cloud_login.models import CloudLoginWorkflowResult

RST = "\x1b[0m"
BOLD = "\x1b[1m"
DIM = "\x1b[2m"
WHITE_BOLD = "\x1b[1;37m"
BLUE = "\x1b[38;5;75m"
BLUE_DIM = "\x1b[38;5;69m"
ACCENT = "\x1b[38;5;252m"
GRADIENT = (
    "\x1b[38;5;255m",
    "\x1b[38;5;253m",
    "\x1b[38;5;251m",
    "\x1b[38;5;249m",
    "\x1b[38;5;246m",
    "\x1b[38;5;243m",
)
LOGO_LINES = (
    " █████╗ ██╗     ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗",
    "██╔══██╗██║     ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝",
    "███████║██║     ██╔████╔██║███████║██╔██╗ ██║███████║██║     ",
    "██╔══██║██║     ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║     ",
    "██║  ██║███████╗██║ ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╗",
    "╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝",
)


def render_setup_result(result: SetupResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    render_setup_text(result)


def render_uninstall_result(result: UninstallResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    render_uninstall_text(result)


def render_setup_text(result: SetupResult) -> None:
    render_banner("CodeAlmanac setup", "Cloud setup and agent instructions.")
    if result.cloud_login is not None:
        render_cloud(result.cloud_login)
    render_instructions(result)
    render_next_steps(result)


def render_uninstall_text(result: UninstallResult) -> None:
    render_banner("CodeAlmanac uninstall", "Remove setup-owned local files.")
    if result.kept_instructions:
        step("Agent instructions", "kept")
    else:
        render_changes("Removed artifacts", result.changes)
    if result.kept_automation:
        step("Scheduled automation", "kept")
    elif result.automation_uninstall is not None:
        render_automation_uninstall(result.automation_uninstall, json_output=False)


def render_banner(title: str, subtitle: str) -> None:
    write()
    for line, color in zip(LOGO_LINES, GRADIENT, strict=True):
        write(f"{color}{line}{RST}")
    write(f"\n{WHITE_BOLD}  {title}{RST}")
    write(f"  {DIM}{subtitle}{RST}")
    write()


def render_cloud(result: CloudLoginWorkflowResult) -> None:
    rows = [
        ("cloud", result.api_url),
        ("status", result.status),
    ]
    if result.github_login is not None:
        rows.append(("user", result.github_login))
    render_rows("Cloud", rows)


def render_instructions(result: SetupResult) -> None:
    if result.skipped_instructions:
        step("Agent instructions", "skipped")
        return
    render_changes("Agent instructions", result.changes)


def render_changes(
    title: str,
    changes: tuple[InstructionChange, ...],
) -> None:
    step_active(title)
    for change in changes:
        status = "changed" if change.changed else "ok"
        write(f"  {DIM}│{RST}   {change.target.value:<6} {status:<7} {change.message}")
        for path in change.paths:
            write(f"  {DIM}│{RST}                  {DIM}{path}{RST}")
    write()


def render_next_steps(result: SetupResult) -> None:
    lines: list[str] = []
    for command in result.plan.next_commands:
        lines.append(f"  {ACCENT}{command.label}{RST}")
        lines.append(f"    {BLUE}{shell_command(command.command)}{RST}")
    render_next_steps_box(lines)


def render_rows(
    title: str,
    rows: list[tuple[str, str]],
) -> None:
    step_active(title)
    for label, value in rows:
        write(f"  {DIM}│{RST}   {label:<8} {value}")
    write()


def step(title: str, message: str) -> None:
    step_done(title)
    write(f"  {DIM}│{RST}   {message}")
    write()


def step_active(message: str) -> None:
    write(f"  {BLUE}◆{RST}  {BOLD}{message}{RST}")


def step_done(message: str) -> None:
    write(f"  {BLUE}◇{RST}  {message}")


def render_next_steps_box(lines: list[str]) -> None:
    header = f"  {WHITE_BOLD}Next steps{RST}"
    inner_width = box_inner_width([header, *lines])
    empty = box_row("", inner_width)

    write(f"  {BLUE_DIM}╭{'─' * inner_width}╮{RST}")
    write(empty)
    write(box_row(header, inner_width))
    write(empty)
    for line in lines:
        write(box_row(line, inner_width))
    write(empty)
    write(f"  {BLUE_DIM}╰{'─' * inner_width}╯{RST}")
    write()


def box_inner_width(contents: list[str], min_width: int = 62) -> int:
    terminal_width = get_terminal_size(fallback=(80, 24)).columns
    available = max(40, terminal_width - 6)
    widest = max((visible_width(content) for content in contents), default=0)
    return min(max(min_width, widest), available)


def box_row(content: str, inner_width: int) -> str:
    padding = max(0, inner_width - visible_width(content))
    return f"  {BLUE_DIM}│{RST}{content}{' ' * padding}{BLUE_DIM}│{RST}"


def visible_width(value: str) -> int:
    return len(sub(r"\x1b\[[0-9;]*m", "", value))


def shell_command(command: tuple[str, ...]) -> str:
    return shlex.join(command)


def write(message: str = "") -> None:
    sys.stdout.write(f"{message}\n")

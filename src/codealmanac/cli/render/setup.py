import shlex
import sys

from rich.console import Console
from rich.text import Text

from codealmanac.cli.render.automation import render_automation_uninstall
from codealmanac.cli.render.common import print_json_model
from codealmanac.services.setup.models import (
    InstructionChange,
    SetupResult,
    UninstallResult,
)
from codealmanac.workflows.cloud_login.models import CloudLoginWorkflowResult

LOGO_LINES = (
    " █████╗ ██╗     ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗",
    "██╔══██╗██║     ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝",
    "███████║██║     ██╔████╔██║███████║██╔██╗ ██║███████║██║     ",
    "██╔══██║██║     ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║     ",
    "██║  ██║███████╗██║ ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╗",
    "╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝",
)
LOGO_STYLES = (
    "grey100",
    "grey93",
    "grey85",
    "grey74",
    "grey62",
    "grey50",
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
    console = setup_console()
    render_banner(console, "CodeAlmanac setup", "Cloud setup and agent instructions.")
    if result.cloud_login is not None:
        render_cloud(console, result.cloud_login)
    render_instructions(console, result)
    render_next_steps(console, result)


def render_uninstall_text(result: UninstallResult) -> None:
    console = setup_console()
    render_banner(console, "CodeAlmanac uninstall", "Remove setup-owned local files.")
    if result.kept_instructions:
        step(console, "Agent instructions", "kept")
    else:
        render_changes(console, "Removed artifacts", result.changes)
    if result.kept_automation:
        step(console, "Scheduled automation", "kept")
    elif result.automation_uninstall is not None:
        render_automation_uninstall(result.automation_uninstall, json_output=False)


def render_banner(console: Console, title: str, subtitle: str) -> None:
    console.print()
    for line, style in zip(LOGO_LINES, LOGO_STYLES, strict=True):
        console.print(Text(f"  {line}", style=style))
    console.print(Text(f"\n  {title}", style="bold"))
    console.print(Text(f"  {subtitle}", style="dim"))
    console.print()


def render_cloud(console: Console, result: CloudLoginWorkflowResult) -> None:
    rows = [
        ("cloud", result.api_url),
        ("status", result.status),
    ]
    if result.github_login is not None:
        rows.append(("user", result.github_login))
    render_rows(console, "Cloud", rows)


def render_instructions(console: Console, result: SetupResult) -> None:
    if result.skipped_instructions:
        step(console, "Agent instructions", "skipped")
        return
    render_changes(console, "Agent instructions", result.changes)


def render_changes(
    console: Console,
    title: str,
    changes: tuple[InstructionChange, ...],
) -> None:
    console.print(Text(f"  ◆ {title}", style="bold cyan"))
    for change in changes:
        status = "changed" if change.changed else "ok"
        console.print(f"    {change.target.value:<6} {status:<7} {change.message}")
        for path in change.paths:
            console.print(Text(f"                   {path}", style="dim"))
    console.print()


def render_next_steps(console: Console, result: SetupResult) -> None:
    console.print(Text("  ◆ Next", style="bold cyan"))
    for command in result.plan.next_commands:
        console.print(f"    {command.label}")
        console.print(Text(f"    {shell_command(command.command)}", style="cyan"))
    console.print()


def render_rows(
    console: Console,
    title: str,
    rows: list[tuple[str, str]],
) -> None:
    console.print(Text(f"  ◆ {title}", style="bold cyan"))
    for label, value in rows:
        console.print(f"    {label:<8} {value}")
    console.print()


def step(console: Console, title: str, message: str) -> None:
    console.print(Text(f"  ◆ {title}", style="bold cyan"))
    console.print(f"    {message}\n")


def shell_command(command: tuple[str, ...]) -> str:
    return shlex.join(command)


def setup_console() -> Console:
    return Console(file=sys.stdout, highlight=False)

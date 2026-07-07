import sys

from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from codealmanac.cli.render.brand import ACCENT_STYLE
from codealmanac.cli.render.terminal import shell_command
from codealmanac.services.automation.models import AutomationUninstallResult
from codealmanac.services.setup.models import (
    GlobalStateRemovalResult,
    InstructionChange,
    PackageUninstallResult,
    UninstallResult,
)


def render_uninstall_text(result: UninstallResult) -> None:
    console = setup_console()
    console.print(setup_panel("CodeAlmanac uninstall", "Remove setup-owned files."))
    console.print(changes_panel("Removed artifacts", result.changes))
    if result.automation_uninstall is not None:
        console.print(automation_uninstall_panel(result.automation_uninstall))
    if result.global_state is not None:
        console.print(global_state_panel(result.global_state))
    if result.package_uninstall is not None:
        console.print(package_uninstall_panel(result.package_uninstall))


def setup_panel(title: str, subtitle: str) -> Panel:
    heading = Text(title, style="bold")
    body = Group(heading, Text(subtitle))
    return Panel(body, border_style=ACCENT_STYLE, padding=(1, 2))


def changes_panel(title: str, changes: tuple[InstructionChange, ...]) -> Panel:
    table = Table.grid(padding=(0, 2))
    table.add_column("target", style="bold")
    table.add_column("status")
    table.add_column("message")
    for change in changes:
        table.add_row(change.target.value, change_status(change), change.message)
        for path in change.paths:
            table.add_row("", "", str(path))
    return Panel(
        Group(Text(title, style="bold"), table),
        border_style=ACCENT_STYLE,
        padding=(1, 2),
    )


def automation_uninstall_panel(result: AutomationUninstallResult) -> Panel:
    table = Table.grid(padding=(0, 2))
    table.add_column("label", style="bold")
    table.add_column("value")
    if len(result.removed) == 0:
        table.add_row("automation", "not installed")
    for path in result.removed:
        table.add_row("removed", str(path))
    return Panel(
        Group(Text("Scheduled automation", style="bold"), table),
        border_style=ACCENT_STYLE,
        padding=(1, 2),
    )


def global_state_panel(result: GlobalStateRemovalResult) -> Panel:
    table = Table.grid(padding=(0, 2))
    table.add_column("label", style="bold")
    table.add_column("value")
    table.add_row("status", "removed" if result.removed else "not found")
    table.add_row("path", str(result.path))
    table.add_row("message", result.message)
    return Panel(
        Group(Text("Global state", style="bold"), table),
        border_style=ACCENT_STYLE,
        padding=(1, 2),
    )


def package_uninstall_panel(result: PackageUninstallResult) -> Panel:
    table = Table.grid(padding=(0, 2))
    table.add_column("label", style="bold")
    table.add_column("value")
    table.add_row("status", result.status.value)
    table.add_row("method", result.method.value)
    table.add_row("message", result.message)
    if len(result.command) > 0:
        table.add_row("command", shell_command(result.command))
    if result.exit_code is not None:
        table.add_row("exit code", str(result.exit_code))
    return Panel(
        Group(Text("Installed tool", style="bold"), table),
        border_style=ACCENT_STYLE,
        padding=(1, 2),
    )


def change_status(change: InstructionChange) -> str:
    return "changed" if change.changed else "ok"


def setup_console() -> Console:
    return Console(file=sys.stdout, highlight=False)

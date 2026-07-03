import shlex
import sys

from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from codealmanac.cli.render.common import print_json_model
from codealmanac.services.automation.defaults import duration_text
from codealmanac.services.automation.models import (
    AutomationInstallResult,
    AutomationUninstallResult,
    ScheduledJob,
)
from codealmanac.services.setup.models import (
    InstructionChange,
    SetupResult,
    UninstallResult,
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
    console.print(
        setup_panel(
            "CodeAlmanac setup",
            "Cloud onboarding and local agent support files.",
        )
    )
    console.print(plan_panel(result))
    if result.cloud_login is not None:
        console.print(cloud_login_panel(result.cloud_login))
    if result.skipped_instructions:
        console.print(status_panel("Instructions skipped", "No files changed."))
    else:
        console.print(changes_panel("Agent instructions", result.changes))
    if result.automation_install is not None:
        console.print(automation_install_panel(result.automation_install))
    console.print(next_steps_panel(result))


def render_uninstall_text(result: UninstallResult) -> None:
    console = setup_console()
    console.print(setup_panel("CodeAlmanac uninstall", "Remove setup-owned files."))
    if result.kept_instructions:
        console.print(status_panel("Instructions kept", "No files changed."))
    else:
        console.print(changes_panel("Removed artifacts", result.changes))
    if result.kept_automation:
        console.print(status_panel("Automation kept", "No scheduler entries changed."))
    elif result.automation_uninstall is not None:
        console.print(automation_uninstall_panel(result.automation_uninstall))


def setup_panel(title: str, subtitle: str) -> Panel:
    heading = Text(title, style="bold")
    body = Group(heading, Text(subtitle))
    return Panel(body, border_style="blue", padding=(1, 2))


def status_panel(title: str, message: str) -> Panel:
    body = Group(Text(title, style="bold"), Text(message))
    return Panel(body, border_style="dim", padding=(1, 2))


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
        border_style="blue",
        padding=(1, 2),
    )


def plan_panel(result: SetupResult) -> Panel:
    plan = result.plan
    table = Table.grid(padding=(0, 2))
    table.add_column("label", style="bold")
    table.add_column("value")
    table.add_row("default agent", plan.default_harness.value)
    table.add_row(
        "instruction targets",
        ", ".join(target.value for target in plan.instruction_targets),
    )
    for recommendation in plan.automation:
        label = f"{recommendation.task.value} automation"
        table.add_row(
            label,
            shell_command(recommendation.command),
        )
    return Panel(
        Group(Text("Setup plan", style="bold"), table),
        border_style="blue",
        padding=(1, 2),
    )


def cloud_login_panel(result) -> Panel:
    table = Table.grid(padding=(0, 2))
    table.add_column("label", style="bold")
    table.add_column("value")
    table.add_row("cloud", result.api_url)
    table.add_row("status", result.status)
    if result.github_login is not None:
        table.add_row("user", result.github_login)
    return Panel(
        Group(Text("Cloud", style="bold"), table),
        border_style="green",
        padding=(1, 2),
    )


def automation_install_panel(result: AutomationInstallResult) -> Panel:
    table = Table.grid(padding=(0, 2))
    table.add_column("task", style="bold")
    table.add_column("value")
    for job in result.jobs:
        add_job_rows(table, job)
    for job in result.disabled:
        table.add_row(job.task.value, "disabled")
    return Panel(
        Group(Text("Scheduled automation", style="bold"), table),
        border_style="green",
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
        border_style="blue",
        padding=(1, 2),
    )


def add_job_rows(table: Table, job: ScheduledJob) -> None:
    table.add_row(job.task.value, f"every {duration_text(job.interval)}")
    table.add_row("", shell_command(job.program_arguments))
    if job.working_directory is not None:
        table.add_row("", str(job.working_directory))
    table.add_row("", str(job.plist_path))


def next_steps_panel(result: SetupResult) -> Panel:
    table = Table.grid()
    for command in result.plan.next_commands:
        table.add_row(Text(command.label, style="bold"))
        table.add_row(Text(shell_command(command.command), style="cyan"))
    return Panel(
        Group(Text("Next steps", style="bold"), table),
        border_style="green",
        padding=(1, 2),
    )


def change_status(change: InstructionChange) -> str:
    return "changed" if change.changed else "ok"


def shell_command(command: tuple[str, ...]) -> str:
    return shlex.join(command)


def setup_console() -> Console:
    return Console(file=sys.stdout, highlight=False)

from dataclasses import dataclass

from codealmanac.cli.render.brand import (
    BAR,
    BLUE,
    BLUE_DIM,
    DIM,
    RST,
    WHITE_BOLD,
    print_badge,
    print_banner,
)
from codealmanac.cli.render.common import print_json_model
from codealmanac.cli.render.setup.uninstall import render_uninstall_text
from codealmanac.cli.render.terminal import (
    shell_command,
    terminal_width,
    visible_length,
    wrap_with_prefixes,
    write_line,
)
from codealmanac.services.automation.models import (
    AutomationTask,
)
from codealmanac.services.setup.models import (
    SetupResult,
    UninstallResult,
)


@dataclass(frozen=True)
class SetupStep:
    label: str
    status: str
    detail: str


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
    print_banner()
    print_badge()
    write_line("")
    write_line(f"  {WHITE_BOLD}Setup complete{RST}")
    write_line(BAR)
    steps = setup_steps(result)
    for index, step in enumerate(steps):
        render_setup_step(step)
        if index < len(steps) - 1:
            write_line(BAR)
    write_line("")
    render_next_steps_box(next_step_lines(result))


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


def next_step_lines(result: SetupResult) -> tuple[str, ...]:
    lines: list[str] = [
        f"  {WHITE_BOLD}Navigate to your repo of choice:{RST}",
        "",
    ]
    for command in result.plan.next_commands:
        lines.append(f"  {BLUE}{shell_command(command.command)}{RST}")
    return tuple(lines)


def render_next_steps_box(lines: tuple[str, ...]) -> None:
    header = f"  {WHITE_BOLD}Next steps{RST}"
    inner_width = box_inner_width((header, *lines))
    empty = box_row("", inner_width)
    write_line(f"  {BLUE_DIM}╭{'─' * inner_width}╮{RST}")
    write_line(empty)
    write_line(box_row(header, inner_width))
    write_line(empty)
    for line in lines:
        write_line(box_row(line, inner_width))
    write_line(empty)
    write_line(f"  {BLUE_DIM}╰{'─' * inner_width}╯{RST}")
    write_line("")


def box_inner_width(contents: tuple[str, ...], min_width: int = 62) -> int:
    available = max(40, terminal_width() - 6)
    widest = max((visible_length(content) for content in contents), default=0)
    return min(max(min_width, widest), available)


def box_row(content: str, inner_width: int) -> str:
    padding = max(0, inner_width - visible_length(content))
    return f"  {BLUE_DIM}│{RST}{content}{' ' * padding}{BLUE_DIM}│{RST}"


def setup_steps(result: SetupResult) -> tuple[SetupStep, ...]:
    return (
        instruction_step(result),
        ai_runner_step(result),
        wiki_maintenance_step(result),
        product_update_step(result),
        change_handling_step(result),
    )


def instruction_step(result: SetupResult) -> SetupStep:
    if result.skipped_instructions:
        return SetupStep("Agent instructions", "skipped", "left unchanged")
    changed = any(change.changed for change in result.changes)
    status = "installed" if changed else "ready"
    return SetupStep("Agent instructions", status, instruction_detail(result))


def instruction_detail(result: SetupResult) -> str:
    if len(result.changes) == 0:
        return ", ".join(target.value for target in result.plan.instruction_targets)
    return "; ".join(change.message for change in result.changes)


def ai_runner_step(result: SetupResult) -> SetupStep:
    return SetupStep(
        "AI runner",
        result.plan.default_harness.value,
        f"{result.plan.harness_model} will run CodeAlmanac jobs",
    )


def product_update_step(result: SetupResult) -> SetupStep:
    return automation_step(result, AutomationTask.UPDATE, "Product updates")


def automation_step(result: SetupResult, task: AutomationTask, label: str) -> SetupStep:
    if result.automation_install is None:
        return SetupStep(label, "skipped", "not requested")
    installed = {job.task for job in result.automation_install.jobs}
    disabled = {job.task for job in result.automation_install.disabled}
    if task in installed:
        return SetupStep(label, "installed", installed_automation_detail(result, task))
    if task in disabled:
        return SetupStep(label, "disabled", disabled_automation_detail(task))
    return SetupStep(label, "skipped", skipped_automation_detail(task))


def wiki_maintenance_step(result: SetupResult) -> SetupStep:
    if result.automation_install is None:
        return SetupStep("Wiki maintenance", "manual", "no schedules installed")
    installed = {job.task for job in result.automation_install.jobs}
    if AutomationTask.SYNC in installed and AutomationTask.GARDEN in installed:
        return SetupStep(
            "Wiki maintenance",
            "automatic",
            "sync and garden your wikis",
        )
    if AutomationTask.SYNC in installed:
        return SetupStep(
            "Wiki maintenance",
            "partial",
            "sync is on; Garden is off",
        )
    if AutomationTask.GARDEN in installed:
        return SetupStep(
            "Wiki maintenance",
            "partial",
            "Garden is on; sync is off",
        )
    return SetupStep("Wiki maintenance", "manual", "no schedules installed")


def installed_automation_detail(result: SetupResult, task: AutomationTask) -> str:
    if task == AutomationTask.UPDATE:
        return "auto-update on"
    return automation_detail(result, task)


def skipped_automation_detail(task: AutomationTask) -> str:
    if task == AutomationTask.UPDATE:
        return "auto-update off"
    return "disabled by setup option"


def disabled_automation_detail(task: AutomationTask) -> str:
    if task == AutomationTask.UPDATE:
        return "auto-update off"
    return "removed existing schedule"


def automation_detail(result: SetupResult, task: AutomationTask) -> str:
    for recommendation in result.plan.automation:
        if recommendation.task == task:
            return recommendation.description
    return "scheduled"


def change_handling_step(result: SetupResult) -> SetupStep:
    enabled = result.plan.auto_commit
    status = "commit" if enabled else "worktree"
    detail = (
        "agents may create almanac: commits after wiki edits"
        if enabled
        else "agents leave wiki edits in the worktree for review"
    )
    return SetupStep("Agent change handling", status, detail)

from codealmanac.cli.render.brand import (
    BAR,
    BLUE,
    BLUE_DIM,
    RST,
    WHITE_BOLD,
    print_badge,
    print_banner,
)
from codealmanac.cli.render.common import print_json_model
from codealmanac.cli.render.setup.background_items import (
    background_item_confirmation_notice,
    render_background_item_notice,
    scheduler_unavailable_notice,
)
from codealmanac.cli.render.setup.steps import SetupStep, render_setup_step
from codealmanac.cli.render.setup.uninstall import render_uninstall_text
from codealmanac.cli.render.terminal import (
    shell_command,
    terminal_width,
    visible_length,
    write_line,
)
from codealmanac.services.automation.models import (
    AutomationTask,
)
from codealmanac.services.setup.models import (
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
    background_notice = background_item_confirmation_notice(
        scheduled_automation_tasks(result)
    )
    if background_notice is not None:
        write_line(BAR)
        render_background_item_notice(background_notice)
    if automation_scheduling_unavailable(result):
        write_line(BAR)
        render_background_item_notice(scheduler_unavailable_notice())
    write_line("")
    render_next_steps_box(next_step_lines(result))


def scheduled_automation_tasks(result: SetupResult) -> tuple[AutomationTask, ...]:
    return tuple(
        item.task for item in result.config_update.automation if item.scheduled
    )


def automation_scheduling_unavailable(result: SetupResult) -> bool:
    return any(
        item.enabled and not item.scheduled
        for item in result.config_update.automation
    )


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
    readiness = result.runner_readiness
    runner = result.plan.default_harness.value
    if readiness is not None and not readiness.available:
        return SetupStep(
            "AI runner",
            f"{runner} unavailable",
            f"{readiness.message}; install {runner} or rerun setup "
            "with --runner, then verify with: codealmanac doctor",
            warning=True,
        )
    return SetupStep(
        "AI runner",
        runner,
        f"{result.plan.harness_model} will run CodeAlmanac jobs",
    )


def product_update_step(result: SetupResult) -> SetupStep:
    return automation_step(result, AutomationTask.UPDATE, "Product updates")


def automation_step(result: SetupResult, task: AutomationTask, label: str) -> SetupStep:
    applied = {item.task: item for item in result.config_update.automation}
    item = applied.get(task)
    if item is None:
        return SetupStep(label, "skipped", "not requested")
    if item.enabled and not item.scheduled:
        return SetupStep(label, "manual", "scheduling unavailable on this platform")
    if item.enabled:
        return SetupStep(label, "installed", installed_automation_detail(result, task))
    return SetupStep(label, "disabled", disabled_automation_detail(task))


def wiki_maintenance_step(result: SetupResult) -> SetupStep:
    if len(result.config_update.automation) == 0:
        return SetupStep("Wiki maintenance", "manual", "no schedules installed")
    installed = {
        item.task for item in result.config_update.automation if item.scheduled
    }
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

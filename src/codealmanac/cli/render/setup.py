import shlex
import shutil
import sys
from dataclasses import dataclass

from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from codealmanac.cli.render.common import print_json_model
from codealmanac.services.automation.models import (
    AutomationTask,
    AutomationUninstallResult,
)
from codealmanac.services.setup.models import (
    GlobalStateRemovalResult,
    InstructionChange,
    PackageUninstallResult,
    SetupResult,
    UninstallResult,
)

RST = "\x1b[0m"
BOLD = "\x1b[1m"
DIM = "\x1b[2m"
WHITE_BOLD = "\x1b[1;37m"
BLUE = "\x1b[38;5;75m"
BLUE_DIM = "\x1b[38;5;69m"
ACCENT_BG = "\x1b[48;5;252m\x1b[38;5;16m"
CLAUDE_CORAL = "\x1b[38;5;173m"
CODEX_PERIWINKLE = "\x1b[38;5;105m"

BRAND_COLORS = {
    "Codex": CODEX_PERIWINKLE,
    "Claude": CLAUDE_CORAL,
}
DIFF_RED = "\x1b[38;5;203m"
DIFF_GREEN = "\x1b[38;5;76m"

GRADIENT = (
    "\x1b[38;5;255m",
    "\x1b[38;5;253m",
    "\x1b[38;5;251m",
    "\x1b[38;5;249m",
    "\x1b[38;5;246m",
    "\x1b[38;5;243m",
)

SETUP_BANNER = (
    " █████╗ ██╗     ███╗   ███╗ █████╗ ███╗   ██╗ █████╗  ██████╗",
    "██╔══██╗██║     ████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝",
    "███████║██║     ██╔████╔██║███████║██╔██╗ ██║███████║██║     ",
    "██╔══██║██║     ██║╚██╔╝██║██╔══██║██║╚██╗██║██╔══██║██║     ",
    "██║  ██║███████╗██║ ╚═╝ ██║██║  ██║██║ ╚████║██║  ██║╚██████╗",
    "╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝",
)

ACCENT_STYLE = "bright_blue"
BAR = f"  {DIM}│{RST}"


@dataclass(frozen=True)
class SetupStep:
    label: str
    status: str
    detail: str


@dataclass(frozen=True)
class SetupChoiceOption:
    label: str
    description: tuple[str, ...]
    shortcuts: tuple[str, ...] = ()


@dataclass(frozen=True)
class SetupChoiceScreen:
    step: int
    title: str
    question: str
    options: tuple[SetupChoiceOption, ...]
    visual: str = "cards"


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


def render_setup_choice_screen(
    screen: SetupChoiceScreen,
    selected_index: int,
) -> None:
    write_line("\x1b[2J\x1b[H")
    print_banner("The self-updating wiki for your coding agents.")
    print_badge()
    write_line("")
    write_line(
        f"  {BLUE}◆{RST}  "
        f"{DIM}[{screen.step}/4]{RST} "
        f"{WHITE_BOLD}{screen.title}{RST}"
    )
    write_line(BAR)
    for line in wrap_with_prefixes(screen.question, f"{BAR}   ", f"{BAR}   ", 78):
        write_line(line)
    write_line(BAR)
    write_line("")
    if screen.visual == "change-handling":
        render_change_handling_choice(selected_index)
    else:
        render_option_cards(screen.options, selected_index)
    write_line("")
    write_line(
        f"  {DIM}│{RST}   "
        f"{BLUE}{BOLD}[←/→]{RST} switch   "
        f"{BLUE}{BOLD}[enter]{RST} choose"
    )
    write_line("")


def render_option_cards(
    options: tuple[SetupChoiceOption, ...],
    selected_index: int,
) -> None:
    card_width = 21 if len(options) == 3 else 34
    card_lines = tuple(
        option_card(option, card_width, index == selected_index)
        for index, option in enumerate(options)
    )
    rows = max(len(lines) for lines in card_lines)
    for row in range(rows):
        parts = []
        for lines in card_lines:
            parts.append(lines[row] if row < len(lines) else " " * (card_width + 2))
        write_line("   " + "   ".join(parts))
    indicator_parts = [
        selected_indicator(card_width)
        if index == selected_index
        else " " * (card_width + 2)
        for index in range(len(options))
    ]
    write_line("   " + "   ".join(indicator_parts))


def option_card(
    option: SetupChoiceOption,
    width: int,
    selected: bool,
) -> tuple[str, ...]:
    border = BLUE if selected else DIM
    body = RST if selected else DIM
    lines = [
        f"{border}╭{'─' * width}╮{RST}",
        card_row("", width, border),
        card_center_row(option_label(option.label, selected), width, border),
    ]
    for description in option.description:
        lines.append(card_center_row(f"{body}{description}{RST}", width, border))
    lines.append(card_row("", width, border))
    lines.append(f"{border}╰{'─' * width}╯{RST}")
    return tuple(lines)


def option_label(label: str, selected: bool) -> str:
    return " ".join(label_word(word, selected) for word in label.split(" "))


def label_word(word: str, selected: bool) -> str:
    color = BRAND_COLORS.get(word)
    if color is None:
        style = WHITE_BOLD if selected else DIM
    elif selected:
        style = f"{BOLD}{color}"
    else:
        style = f"{DIM}{color}"
    return f"{style}{word}{RST}"


def card_row(content: str, width: int, border: str) -> str:
    padding = max(0, width - visible_length(content))
    return f"{border}│{RST}{content}{' ' * padding}{border}│{RST}"


def card_right_row(content: str, width: int, border: str) -> str:
    padding = max(0, width - visible_length(content) - 2)
    return f"{border}│{RST}{' ' * padding}{content}  {border}│{RST}"


def card_center_row(content: str, width: int, border: str) -> str:
    visible = visible_length(content)
    left = max(0, (width - visible) // 2)
    right = max(0, width - visible - left)
    return f"{border}│{RST}{' ' * left}{content}{' ' * right}{border}│{RST}"


def selected_indicator(width: int) -> str:
    text = "◆ selected"
    left_padding = max(0, (width + 2 - len(text)) // 2)
    right_padding = max(0, width + 2 - left_padding - len(text))
    return f"{' ' * left_padding}{BLUE}{BOLD}{text}{RST}{' ' * right_padding}"


def render_change_handling_choice(selected_index: int) -> None:
    width = 34
    cards = (
        change_handling_commit_card(width, selected_index == 0),
        change_handling_worktree_card(width, selected_index == 1),
    )
    rows = max(len(lines) for lines in cards)
    for row in range(rows):
        left = cards[0][row] if row < len(cards[0]) else " " * (width + 2)
        right = cards[1][row] if row < len(cards[1]) else " " * (width + 2)
        write_line(f"   {left}   {right}")
    left_indicator = (
        selected_indicator(width) if selected_index == 0 else " " * (width + 2)
    )
    right_indicator = (
        selected_indicator(width) if selected_index == 1 else " " * (width + 2)
    )
    write_line(f"   {left_indicator}   {right_indicator}")


def change_handling_commit_card(width: int, selected: bool) -> tuple[str, ...]:
    border = BLUE if selected else DIM
    title = WHITE_BOLD if selected else DIM
    muted = RST if selected else DIM
    commit = BLUE if selected else DIM
    return (
        f"{border}╭{'─' * width}╮{RST}",
        card_row("", width, border),
        card_row(f" {title}Commit changes{RST}", width, border),
        card_row("", width, border),
        card_row(f" {commit}● almanac: update wiki context{RST}", width, border),
        card_row(f" {muted}│ rohan · just now{RST}", width, border),
        card_row(f" {muted}│{RST}", width, border),
        card_row(f" {muted}● docs: previous repo commit{RST}", width, border),
        card_row(f" {muted}│ rohan · earlier{RST}", width, border),
        card_row("", width, border),
        card_row("", width, border),
        f"{border}╰{'─' * width}╯{RST}",
    )


def change_handling_worktree_card(width: int, selected: bool) -> tuple[str, ...]:
    border = BLUE if selected else DIM
    title = WHITE_BOLD if selected else DIM
    muted = RST if selected else DIM
    delete = DIFF_RED if selected else DIM
    add = DIFF_GREEN if selected else DIM
    return (
        f"{border}╭{'─' * width}╮{RST}",
        card_row("", width, border),
        card_row(f" {title}Leave in worktree{RST}", width, border),
        card_row("", width, border),
        card_row(f" {muted}almanac/architecture/indexing.md{RST}", width, border),
        card_right_row(f"{delete}-18{RST} {add}+42{RST}", width, border),
        card_row(f" {muted}almanac/decisions/local-first.md{RST}", width, border),
        card_right_row(f"{delete}-4{RST} {add}+19{RST}", width, border),
        card_row(f" {muted}almanac/guides/setup.md{RST}", width, border),
        card_right_row(f"{delete}-2{RST} {add}+11{RST}", width, border),
        card_row("", width, border),
        f"{border}╰{'─' * width}╯{RST}",
    )


def print_banner(subtitle: str | None = None) -> None:
    write_line("")
    for index, line in enumerate(SETUP_BANNER):
        color = GRADIENT[index]
        write_line(f"{color}{line}{RST}")
    write_line("")
    if subtitle is not None:
        write_line(f"{WHITE_BOLD}  {subtitle}{RST}")
        return
    write_line(f"{WHITE_BOLD}  The self-updating wiki for your coding agents.{RST}")
    write_line(
        f"{DIM}  Machine setup only. Repo wikis still start with"
        f" codealmanac init.{RST}"
    )


def print_badge() -> None:
    write_line("")
    write_line(f"   {ACCENT_BG} codealmanac {RST}")


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


def wrap_with_prefixes(
    text: str,
    first_prefix: str,
    next_prefix: str,
    width: int,
) -> tuple[str, ...]:
    words = tuple(word for word in text.split(" ") if len(word) > 0)
    if len(words) == 0:
        return (first_prefix,)
    lines: list[str] = []
    prefix = first_prefix
    line = prefix
    has_word = False
    for word in words:
        candidate = f"{line} {word}" if has_word else f"{prefix}{word}"
        if has_word and visible_length(candidate) > width:
            lines.append(line)
            prefix = next_prefix
            line = f"{prefix}{word}"
            has_word = True
            continue
        line = candidate
        has_word = True
    lines.append(line)
    return tuple(lines)


def visible_length(value: str) -> int:
    count = 0
    in_escape = False
    for character in value:
        if character == "\x1b":
            in_escape = True
            continue
        if in_escape:
            if character == "m":
                in_escape = False
            continue
        count += 1
    return count


def terminal_width() -> int:
    return shutil.get_terminal_size((80, 24)).columns


def write_line(line: str) -> None:
    sys.stdout.write(f"{line}\n")


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


def setup_steps(result: SetupResult) -> tuple[SetupStep, ...]:
    return (
        instruction_step(result),
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


def shell_command(command: tuple[str, ...]) -> str:
    return shlex.join(command)


def setup_console() -> Console:
    return Console(file=sys.stdout, highlight=False)

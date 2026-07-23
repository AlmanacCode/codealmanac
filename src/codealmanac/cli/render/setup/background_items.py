from dataclasses import dataclass

from codealmanac.cli.render.brand import BAR, BLUE, RST, WHITE_BOLD
from codealmanac.cli.render.terminal import wrap_with_prefixes, write_line
from codealmanac.core.platform import platform_label
from codealmanac.services.automation.models import AutomationTask


@dataclass(frozen=True)
class BackgroundItemNotice:
    title: str
    lines: tuple[str, ...]


def render_background_item_notice(notice: BackgroundItemNotice) -> None:
    write_line(f"  {BLUE}◆{RST}  {WHITE_BOLD}{notice.title}{RST}")
    for text in notice.lines:
        for line in wrap_with_prefixes(text, f"{BAR}   ", f"{BAR}   ", 78):
            write_line(line)


def render_selected_background_item_notice(
    notices: tuple[BackgroundItemNotice | None, ...],
    selected_index: int,
) -> None:
    if selected_index >= len(notices):
        return
    notice = notices[selected_index]
    if notice is None:
        return
    write_line("")
    render_background_item_notice(notice)


def background_item_choice_notice(
    tasks: tuple[AutomationTask, ...],
) -> BackgroundItemNotice | None:
    if len(tasks) == 0:
        return None
    count = len(tasks)
    task_word = "task" if count == 1 else "tasks"
    notification_word = "notification" if count == 1 else "notifications"
    return BackgroundItemNotice(
        title="macOS heads-up",
        lines=(
            f"This adds {count} CodeAlmanac background {task_word}: "
            f"{automation_task_names(tasks)}.",
            f"macOS may show {count} “Background Items Added” "
            f"{notification_word}—one per task.",
            "They are expected and all from CodeAlmanac.",
        ),
    )


def background_item_selection_notices(
    automatic_maintenance: bool,
) -> tuple[BackgroundItemNotice | None, ...]:
    maintenance_tasks = (
        (AutomationTask.SYNC, AutomationTask.GARDEN) if automatic_maintenance else ()
    )
    return (
        background_item_choice_notice((*maintenance_tasks, AutomationTask.UPDATE)),
        background_item_choice_notice(maintenance_tasks),
    )


def background_item_confirmation_notice(
    tasks: tuple[AutomationTask, ...],
) -> BackgroundItemNotice | None:
    if len(tasks) == 0:
        return None
    count = len(tasks)
    notification_word = "notification" if count == 1 else "notifications"
    return BackgroundItemNotice(
        title="macOS background items",
        lines=(
            f"macOS may have shown {count} “Background Items Added” "
            f"{notification_word}.",
            f"Those are CodeAlmanac's {automation_task_names(tasks)} schedules.",
        ),
    )


def scheduler_unavailable_notice() -> BackgroundItemNotice:
    return BackgroundItemNotice(
        title="Scheduled automation unavailable",
        lines=(
            f"CodeAlmanac can't schedule background jobs on {platform_label()} yet.",
            "Run codealmanac sync and codealmanac garden manually, or wire them "
            "into your own cron/systemd timer.",
        ),
    )


def automation_task_names(tasks: tuple[AutomationTask, ...]) -> str:
    names = tuple(
        {
            AutomationTask.SYNC: "Sync",
            AutomationTask.GARDEN: "Garden",
            AutomationTask.UPDATE: "Update",
        }[task]
        for task in tasks
    )
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return f"{', '.join(names[:-1])}, and {names[-1]}"

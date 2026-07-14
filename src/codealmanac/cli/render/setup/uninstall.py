from codealmanac.cli.render.brand import BAR, RST, WHITE_BOLD
from codealmanac.cli.render.setup.steps import SetupStep, render_setup_step
from codealmanac.cli.render.terminal import shell_command, write_line
from codealmanac.services.automation.models import AutomationRemoveResult
from codealmanac.services.setup.models import (
    GlobalStateRemovalResult,
    InstructionChange,
    PackageUninstallResult,
    PackageUninstallStatus,
    UninstallResult,
)


def render_uninstall_text(result: UninstallResult) -> None:
    # This runs after the package may have uninstalled itself from disk, so
    # this path must not trigger imports at render time (rich's lazy module
    # loading crashed here once the site-packages files were gone).
    write_line("")
    write_line(f"  {WHITE_BOLD}CodeAlmanac uninstall{RST}")
    write_line(BAR)
    steps = uninstall_steps(result)
    for index, step in enumerate(steps):
        render_setup_step(step)
        if index < len(steps) - 1:
            write_line(BAR)
    write_line("")


def uninstall_steps(result: UninstallResult) -> tuple[SetupStep, ...]:
    steps = [artifacts_step(result.changes)]
    if result.automation_uninstall is not None:
        steps.append(automation_step(result.automation_uninstall))
    if result.global_state is not None:
        steps.append(global_state_step(result.global_state))
    if result.package_uninstall is not None:
        steps.append(package_step(result.package_uninstall))
    return tuple(steps)


def artifacts_step(changes: tuple[InstructionChange, ...]) -> SetupStep:
    status = "removed" if any(change.changed for change in changes) else "ok"
    detail = "; ".join(change.message for change in changes) or "nothing installed"
    return SetupStep("Removed artifacts", status, detail)


def automation_step(result: AutomationRemoveResult) -> SetupStep:
    if len(result.removed) == 0:
        return SetupStep("Scheduled automation", "not installed", "no schedules found")
    detail = "; ".join(str(path) for path in result.removed)
    return SetupStep("Scheduled automation", "removed", detail)


def global_state_step(result: GlobalStateRemovalResult) -> SetupStep:
    status = "removed" if result.removed else "not found"
    return SetupStep("Global state", status, str(result.path))


def package_step(result: PackageUninstallResult) -> SetupStep:
    detail = result.message
    if len(result.command) > 0:
        detail = f"{result.message}: {shell_command(result.command)}"
    return SetupStep(
        "Installed tool",
        result.status.value,
        detail,
        warning=result.status == PackageUninstallStatus.FAILED,
    )

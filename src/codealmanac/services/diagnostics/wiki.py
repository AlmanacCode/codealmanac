from collections.abc import Sequence

from codealmanac.core.errors import CodeAlmanacError, NotFoundError
from codealmanac.manual import ManualLibrary
from codealmanac.services.diagnostics.messages import (
    first_line,
    health_problem_count,
    index_message,
    problem_word,
)
from codealmanac.services.diagnostics.models import (
    DoctorCheck,
    DoctorStatus,
)
from codealmanac.services.diagnostics.requests import DoctorRequest
from codealmanac.services.index.service import IndexService
from codealmanac.services.workspaces.models import Workspace, WorkspaceRegistryStatus
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService
from codealmanac.services.workspaces.status import workspace_registry_status


def wiki_checks(
    request: DoctorRequest,
    *,
    workspaces: WorkspacesService,
    index: IndexService,
    manual: ManualLibrary,
) -> tuple[DoctorCheck, ...]:
    workspace = select_workspace(request, workspaces)
    if isinstance(workspace, DoctorCheck):
        return (workspace,)
    registry_status = workspace_registry_status(workspace)
    checks: list[DoctorCheck] = [
        DoctorCheck(
            key="wiki.repo",
            status=DoctorStatus.INFO,
            message=f"repo: {workspace.root_path}",
        ),
        registered_check(workspace, registry_status),
    ]
    if registry_status != WorkspaceRegistryStatus.AVAILABLE:
        return tuple(checks)
    checks.extend(index_checks(index, workspace))
    checks.append(manual_workspace_check(manual, workspace))
    checks.append(health_check(index, workspace))
    return tuple(checks)


def select_workspace(
    request: DoctorRequest,
    workspaces: WorkspacesService,
) -> Workspace | DoctorCheck:
    try:
        if request.wiki is None:
            return workspaces.resolve(request.cwd)
        return workspaces.select(
            SelectWorkspaceRequest(selector=request.wiki, base_path=request.cwd)
        )
    except NotFoundError as error:
        if request.wiki is None:
            return DoctorCheck(
                key="wiki.none",
                status=DoctorStatus.INFO,
                message="no Almanac wiki found from current directory",
                fix="run: codealmanac init",
            )
        return DoctorCheck(
            key="wiki.selected",
            status=DoctorStatus.PROBLEM,
            message=first_line(str(error)),
            fix="run: codealmanac list",
        )
    except CodeAlmanacError as error:
        return DoctorCheck(
            key="wiki.selected",
            status=DoctorStatus.PROBLEM,
            message=first_line(str(error)),
            fix="run: codealmanac list",
        )


def index_checks(index: IndexService, workspace: Workspace) -> Sequence[DoctorCheck]:
    try:
        summary = index.summary(workspace.workspace_id)
    except Exception as error:
        return (
            DoctorCheck(
                key="wiki.index",
                status=DoctorStatus.PROBLEM,
                message=f"could not rebuild index: {first_line(str(error))}",
                fix="run: codealmanac reindex",
            ),
        )
    return (
        DoctorCheck(
            key="wiki.index",
            status=DoctorStatus.OK,
            message=index_message(summary),
        ),
    )


def manual_workspace_check(
    manual: ManualLibrary,
    workspace: Workspace,
) -> DoctorCheck:
    try:
        status = manual.workspace_status(workspace.almanac_path / "manual")
    except CodeAlmanacError as error:
        return DoctorCheck(
            key="wiki.manual",
            status=DoctorStatus.PROBLEM,
            message=f"manual unavailable: {first_line(str(error))}",
            fix="run: codealmanac build",
        )
    if status.complete:
        if len(status.changed) > 0:
            changed = ", ".join(status.changed)
            return DoctorCheck(
                key="wiki.manual",
                status=DoctorStatus.INFO,
                message=f"manual differs: {changed}",
                fix=(
                    "review local manual files; "
                    "codealmanac build preserves existing files"
                ),
            )
        return DoctorCheck(
            key="wiki.manual",
            status=DoctorStatus.OK,
            message=f"manual: {len(status.present)} docs",
        )
    missing = ", ".join(status.missing)
    return DoctorCheck(
        key="wiki.manual",
        status=DoctorStatus.PROBLEM,
        message=f"manual missing: {missing}",
        fix="run: codealmanac build",
    )


def health_check(index: IndexService, workspace: Workspace) -> DoctorCheck:
    try:
        report = index.health_report(workspace.workspace_id)
    except Exception as error:
        return DoctorCheck(
            key="wiki.health",
            status=DoctorStatus.PROBLEM,
            message=f"could not run health: {first_line(str(error))}",
            fix="run: codealmanac health",
        )
    problems = health_problem_count(report)
    if problems == 0:
        return DoctorCheck(
            key="wiki.health",
            status=DoctorStatus.OK,
            message="health: 0 problems",
        )
    return DoctorCheck(
        key="wiki.health",
        status=DoctorStatus.PROBLEM,
        message=f"health: {problems} {problem_word(problems)}",
        fix="run: codealmanac health",
    )


def registered_check(
    workspace: Workspace,
    status: WorkspaceRegistryStatus,
) -> DoctorCheck:
    registered = (
        f"registered as '{workspace.name}' ({workspace.almanac_root.as_posix()})"
    )
    if status == WorkspaceRegistryStatus.AVAILABLE:
        return DoctorCheck(
            key="wiki.registered",
            status=DoctorStatus.OK,
            message=registered,
        )
    if status == WorkspaceRegistryStatus.MISSING_REPO:
        return DoctorCheck(
            key="wiki.registered",
            status=DoctorStatus.PROBLEM,
            message=f"{registered}, but repo path is missing",
            fix=f"run: codealmanac list --drop {workspace.workspace_id}",
        )
    return DoctorCheck(
        key="wiki.registered",
        status=DoctorStatus.PROBLEM,
        message=f"{registered}, but Almanac root is missing: {workspace.almanac_path}",
        fix="run: codealmanac build",
    )


import platform
import sys
from collections.abc import Sequence

from codealmanac.core.errors import CodeAlmanacError, NotFoundError
from codealmanac.services.diagnostics.models import (
    DoctorCheck,
    DoctorReport,
    DoctorStatus,
)
from codealmanac.services.diagnostics.requests import DoctorRequest
from codealmanac.services.index.models import HealthReport, IndexSummary
from codealmanac.services.index.service import IndexService
from codealmanac.services.workspaces.models import Workspace
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService


class DiagnosticsService:
    def __init__(
        self,
        workspaces: WorkspacesService,
        index: IndexService,
        version: str,
        python_version: str | None = None,
        python_supported: bool | None = None,
    ):
        self.workspaces = workspaces
        self.index = index
        self.version = version
        self.python_version = python_version or platform.python_version()
        if python_supported is None:
            self.python_supported = sys.version_info >= (3, 12)
        else:
            self.python_supported = python_supported

    def check(self, request: DoctorRequest) -> DoctorReport:
        return DoctorReport(
            version=self.version,
            install=self._install_checks(),
            wiki=self._wiki_checks(request),
        )

    def _install_checks(self) -> tuple[DoctorCheck, ...]:
        return (
            DoctorCheck(
                key="install.version",
                status=DoctorStatus.OK,
                message=f"codealmanac {self.version}",
            ),
            DoctorCheck(
                key="install.python",
                status=(
                    DoctorStatus.OK if self.python_supported else DoctorStatus.PROBLEM
                ),
                message=f"python {self.python_version}",
                fix=None
                if self.python_supported
                else "install Python 3.12 or newer",
            ),
            DoctorCheck(
                key="install.registry",
                status=DoctorStatus.INFO,
                message=f"registry: {self.workspaces.registry_path}",
            ),
        )

    def _wiki_checks(self, request: DoctorRequest) -> tuple[DoctorCheck, ...]:
        workspace = self._select_workspace(request)
        if isinstance(workspace, DoctorCheck):
            return (workspace,)
        checks: list[DoctorCheck] = [
            DoctorCheck(
                key="wiki.repo",
                status=DoctorStatus.INFO,
                message=f"repo: {workspace.root_path}",
            ),
            DoctorCheck(
                key="wiki.registered",
                status=DoctorStatus.OK,
                message=f"registered as '{workspace.name}'",
            ),
        ]
        checks.extend(self._index_checks(workspace))
        checks.append(self._health_check(workspace))
        return tuple(checks)

    def _select_workspace(self, request: DoctorRequest) -> Workspace | DoctorCheck:
        try:
            if request.wiki is None:
                return self.workspaces.resolve(request.cwd)
            return self.workspaces.select(
                SelectWorkspaceRequest(selector=request.wiki, base_path=request.cwd)
            )
        except NotFoundError as error:
            if request.wiki is None:
                return DoctorCheck(
                    key="wiki.none",
                    status=DoctorStatus.INFO,
                    message="no .almanac wiki found from current directory",
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

    def _index_checks(self, workspace: Workspace) -> Sequence[DoctorCheck]:
        try:
            summary = self.index.summary(workspace.workspace_id)
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

    def _health_check(self, workspace: Workspace) -> DoctorCheck:
        try:
            report = self.index.health_report(workspace.workspace_id)
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


def index_message(summary: IndexSummary) -> str:
    skip_suffix = (
        f", {summary.files_skipped} skipped" if summary.files_skipped > 0 else ""
    )
    return (
        f"index: {summary.pages} {page_word(summary.pages)}, "
        f"{summary.topics} {topic_word(summary.topics)} "
        f"({summary.files_seen} files seen{skip_suffix})"
    )


def health_problem_count(report: HealthReport) -> int:
    return (
        len(report.orphans)
        + len(report.dead_refs)
        + len(report.broken_links)
        + len(report.broken_xwiki)
        + len(report.empty_topics)
        + len(report.empty_pages)
    )


def first_line(value: str) -> str:
    return value.splitlines()[0] if value.splitlines() else value


def page_word(count: int) -> str:
    return "page" if count == 1 else "pages"


def topic_word(count: int) -> str:
    return "topic" if count == 1 else "topics"


def problem_word(count: int) -> str:
    return "problem" if count == 1 else "problems"

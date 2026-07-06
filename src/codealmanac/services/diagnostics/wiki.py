from collections.abc import Sequence

from codealmanac.core.errors import (
    CodeAlmanacError,
    NoRepositorySelected,
    NotFoundError,
)
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
from codealmanac.services.repositories.models import Repository, RepositoryState
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.repositories.state import repository_state


def wiki_checks(
    request: DoctorRequest,
    *,
    repositories: RepositoriesService,
    index: IndexService,
) -> tuple[DoctorCheck, ...]:
    repository = select_repository(request, repositories)
    if isinstance(repository, DoctorCheck):
        return (repository,)
    state = repository_state(repository)
    checks: list[DoctorCheck] = [
        DoctorCheck(
            key="wiki.repo",
            status=DoctorStatus.INFO,
            message=f"repo: {repository.root_path}",
        ),
        registered_check(repository, state),
    ]
    if state != RepositoryState.AVAILABLE:
        return tuple(checks)
    checks.extend(index_checks(index, repository))
    checks.append(health_check(index, repository))
    return tuple(checks)


def select_repository(
    request: DoctorRequest,
    repositories: RepositoriesService,
) -> Repository | DoctorCheck:
    try:
        return repositories.select_read_repository(request.cwd, request.repository_name)
    except NoRepositorySelected:
        return DoctorCheck(
            key="wiki.none",
            status=DoctorStatus.INFO,
            message="No repository selected.",
            fix="run from a registered repository root or pass --wiki <name>",
        )
    except NotFoundError as error:
        if request.repository_name is None:
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


def index_checks(index: IndexService, repository: Repository) -> Sequence[DoctorCheck]:
    try:
        summary = index.summary(repository.repository_id)
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


def health_check(index: IndexService, repository: Repository) -> DoctorCheck:
    try:
        report = index.health_report(repository.repository_id)
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
    repository: Repository,
    state: RepositoryState,
) -> DoctorCheck:
    registered = (
        f"registered as '{repository.name}' ({repository.almanac_root.as_posix()})"
    )
    if state == RepositoryState.AVAILABLE:
        return DoctorCheck(
            key="wiki.registered",
            status=DoctorStatus.OK,
            message=registered,
        )
    if state == RepositoryState.MISSING_REPO:
        return DoctorCheck(
            key="wiki.registered",
            status=DoctorStatus.PROBLEM,
            message=f"{registered}, but repo path is missing",
            fix=f"registered path: {repository.root_path}",
        )
    return DoctorCheck(
        key="wiki.registered",
        status=DoctorStatus.PROBLEM,
        message=f"{registered}, but Almanac root is missing: {repository.almanac_path}",
        fix="run: codealmanac init",
    )

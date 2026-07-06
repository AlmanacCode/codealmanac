from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.services.health.models import ValidationIssue, ValidationResult
from codealmanac.services.health.reports import (
    health_report_issues,
    validation_failure_message,
)
from codealmanac.services.health.requests import HealthCheckRequest, ValidateWikiRequest
from codealmanac.services.health.runtime import runtime_state_issues
from codealmanac.services.health.sources import source_shape_issues
from codealmanac.services.index.models import HealthReport, IndexRefreshResult
from codealmanac.services.index.service import IndexService
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.service import RepositoriesService


class HealthService:
    def __init__(self, repositories: RepositoriesService, index: IndexService):
        self.repositories = repositories
        self.index = index

    def check(self, request: HealthCheckRequest) -> HealthReport:
        repository = self.select_repository(request.cwd, request.repository_name)
        return self.index.health_report(repository.repository_id)

    def validate(self, request: ValidateWikiRequest) -> ValidationResult:
        repository = self.select_repository(request.cwd, request.repository_name)
        return self.validate_repository(repository)

    def validate_repository(self, repository: Repository) -> ValidationResult:
        issues = [
            *source_shape_issues(repository.almanac_path),
            *runtime_state_issues(repository.almanac_path),
        ]
        index = None
        try:
            index = self.index.ensure_fresh(repository.repository_id)
        except ValidationFailed as error:
            issues.append(
                ValidationIssue(
                    category="page_routes",
                    message=str(error),
                    path=repository.almanac_root.as_posix(),
                )
            )
            return validation_result(repository, index, issues)
        issues.extend(
            health_report_issues(self.index.health_report(repository.repository_id))
        )
        return validation_result(repository, index, issues)

    def ensure_valid(self, repository: Repository) -> ValidationResult:
        result = self.validate_repository(repository)
        if not result.ok:
            raise ValidationFailed(validation_failure_message(result))
        return result

    def select_repository(self, cwd: Path, repository_name: str | None) -> Repository:
        return self.repositories.select_read_repository(cwd, repository_name)


def validation_result(
    repository: Repository,
    index: IndexRefreshResult | None,
    issues: list[ValidationIssue],
) -> ValidationResult:
    return ValidationResult(
        repository_name=repository.name,
        almanac_path=repository.almanac_path,
        index=index,
        issues=tuple(issues),
        ok=len(issues) == 0,
    )

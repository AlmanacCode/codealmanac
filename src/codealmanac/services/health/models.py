from enum import StrEnum
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.index.models import IndexRefreshResult


class IssueSeverity(StrEnum):
    """How a validation issue affects the outcome.

    ERROR fails validation: the wiki is not in a publishable state.
    WARNING is reported but does not fail, for conditions a maintainer should
    see without blocking `validate`, `ensure_valid`, or the workflows gated on
    them.
    """

    ERROR = "error"
    WARNING = "warning"


class ValidationIssue(CodeAlmanacModel):
    category: str
    message: str
    page: str | None = None
    path: str | None = None
    severity: IssueSeverity = IssueSeverity.ERROR


class ValidationResult(CodeAlmanacModel):
    repository_name: str
    almanac_path: Path
    index: IndexRefreshResult | None = None
    issues: tuple[ValidationIssue, ...] = ()
    ok: bool

    @property
    def errors(self) -> tuple[ValidationIssue, ...]:
        return tuple(
            issue
            for issue in self.issues
            if issue.severity is IssueSeverity.ERROR
        )

    @property
    def warnings(self) -> tuple[ValidationIssue, ...]:
        return tuple(
            issue
            for issue in self.issues
            if issue.severity is IssueSeverity.WARNING
        )

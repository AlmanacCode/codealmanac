from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.index.models import IndexRefreshResult


class ValidationIssue(CodeAlmanacModel):
    category: str
    message: str
    page: str | None = None
    path: str | None = None


class ValidationResult(CodeAlmanacModel):
    repository_name: str
    almanac_path: Path
    index: IndexRefreshResult | None = None
    issues: tuple[ValidationIssue, ...] = ()
    ok: bool

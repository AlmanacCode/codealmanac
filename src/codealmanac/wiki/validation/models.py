from enum import StrEnum
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class WikiValidationIssueKind(StrEnum):
    STRUCTURE = "structure"
    FRONTMATTER = "frontmatter"
    TOPICS = "topics"
    READ = "read"


class WikiValidationIssue(CodeAlmanacModel):
    kind: WikiValidationIssueKind
    path: Path
    message: str
    line: int | None = None
    column: int | None = None


class WikiValidationReport(CodeAlmanacModel):
    ok: bool
    almanac_root: Path
    pages_checked: int
    issues: tuple[WikiValidationIssue, ...] = ()

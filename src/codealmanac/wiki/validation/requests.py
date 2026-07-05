from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class ValidateWikiRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None

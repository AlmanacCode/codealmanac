from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class HealthCheckRequest(CodeAlmanacModel):
    cwd: Path
    repository_name: str | None = None


class ValidateWikiRequest(CodeAlmanacModel):
    cwd: Path
    repository_name: str | None = None

from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class HealthCheckRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None

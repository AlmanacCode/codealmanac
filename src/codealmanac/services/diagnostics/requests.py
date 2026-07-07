from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class DoctorRequest(CodeAlmanacModel):
    cwd: Path
    repository_name: str | None = None

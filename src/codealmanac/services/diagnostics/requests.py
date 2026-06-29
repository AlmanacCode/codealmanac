from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class DoctorRequest(CodeAlmanacModel):
    cwd: Path
    wiki: str | None = None

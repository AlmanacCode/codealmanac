from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel


class ControlSchemaStatus(CodeAlmanacModel):
    path: Path
    user_version: int
    tables: tuple[str, ...]

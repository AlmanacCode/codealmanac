from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.harnesses.models import HarnessKind


class RunLocalUpdateRequest(CodeAlmanacModel):
    cwd: Path
    harness: HarnessKind = HarnessKind.CODEX

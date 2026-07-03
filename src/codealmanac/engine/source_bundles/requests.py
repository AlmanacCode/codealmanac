from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.run_ids import EngineRunId
from codealmanac.engine.source_bundles.models import SourceBundleSessionInput


class MaterializeSourceBundleRequest(CodeAlmanacModel):
    run_id: EngineRunId
    branch_id: str
    target_path: Path
    sessions: tuple[SourceBundleSessionInput, ...] = ()

    @field_validator("branch_id")
    @classmethod
    def require_branch_id(cls, value: str) -> str:
        return required_text(value, "source bundle branch id")

from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel


class ResolveSourcesRequest(CodeAlmanacModel):
    cwd: Path
    inputs: tuple[str, ...]

    @field_validator("inputs")
    @classmethod
    def require_inputs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) == 0:
            raise ValueError("at least one source input is required")
        return value

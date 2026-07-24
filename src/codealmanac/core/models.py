from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict


class CodeAlmanacModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


def _require_non_negative_limit(value: int | None) -> int | None:
    if value is not None and value < 0:
        raise ValueError("limit must be non-negative")
    return value


NonNegativeLimit = Annotated[int | None, AfterValidator(_require_non_negative_limit)]
RequiredNonNegativeLimit = Annotated[int, AfterValidator(_require_non_negative_limit)]

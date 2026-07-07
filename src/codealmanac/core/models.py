from pydantic import BaseModel, ConfigDict


class CodeAlmanacModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

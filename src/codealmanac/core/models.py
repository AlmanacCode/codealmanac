from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from codealmanac.core.paths import (
    default_config_path,
    default_control_db_path,
    default_registry_path,
)


class CodeAlmanacModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class AppConfig(CodeAlmanacModel):
    registry_path: Path = Field(default_factory=default_registry_path)
    config_path: Path = Field(default_factory=default_config_path)
    control_db_path: Path = Field(default_factory=default_control_db_path)

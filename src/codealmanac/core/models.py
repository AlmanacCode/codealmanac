from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from codealmanac.core.paths import (
    default_auth_path,
    default_capture_events_path,
    default_capture_path,
    default_config_path,
    default_control_db_path,
    default_engine_workspaces_path,
    default_jobs_path,
    default_registry_path,
    default_run_artifacts_path,
)


class CodeAlmanacModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class AppConfig(CodeAlmanacModel):
    registry_path: Path = Field(default_factory=default_registry_path)
    config_path: Path = Field(default_factory=default_config_path)
    auth_path: Path = Field(default_factory=default_auth_path)
    capture_path: Path = Field(default_factory=default_capture_path)
    capture_events_path: Path = Field(default_factory=default_capture_events_path)
    control_db_path: Path = Field(default_factory=default_control_db_path)
    run_artifacts_path: Path = Field(default_factory=default_run_artifacts_path)
    jobs_path: Path = Field(default_factory=default_jobs_path)
    engine_workspaces_path: Path = Field(default_factory=default_engine_workspaces_path)

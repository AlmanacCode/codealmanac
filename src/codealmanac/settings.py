from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.paths import (
    default_config_path,
    default_database_path,
    normalize_path,
)


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CODEALMANAC_",
        frozen=True,
        extra="forbid",
    )

    database_path: Path = Field(default_factory=default_database_path)
    config_path: Path = Field(default_factory=default_config_path)

    @field_validator("database_path", "config_path")
    @classmethod
    def normalize_config_path(cls, value: Path) -> Path:
        return normalize_path(value)


class LocalStatePaths(CodeAlmanacModel):
    database_path: Path
    config_path: Path
    state_dir: Path

    @model_validator(mode="after")
    def validate_database_in_state_dir(self) -> "LocalStatePaths":
        if self.database_path.parent != self.state_dir:
            raise ValueError("database_path must live directly inside state_dir")
        return self

    @classmethod
    def from_config(cls, config: AppConfig) -> "LocalStatePaths":
        state_dir = config.database_path.parent
        config_path = config.config_path
        if "config_path" not in config.model_fields_set:
            config_path = state_dir / "config.toml"
        return cls(
            database_path=config.database_path,
            config_path=normalize_path(config_path),
            state_dir=state_dir,
        )

    def repository_dir(self, repository_id: str) -> Path:
        return self.state_dir / "repos" / repository_id

    @property
    def update_lock_path(self) -> Path:
        return self.state_dir / "update.lock"

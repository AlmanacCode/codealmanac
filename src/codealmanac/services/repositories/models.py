from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Annotated

from pydantic import Field, StringConstraints, field_validator, model_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.repositories.roots import (
    DEFAULT_ALMANAC_ROOT,
    require_default_almanac_root,
)

RepositoryName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1),
]


class Project(CodeAlmanacModel):
    project_id: str
    name: RepositoryName
    description: str = ""
    created_at: datetime


class Workspace(CodeAlmanacModel):
    workspace_id: str
    project_id: str
    root_path: Path
    almanac_root: Path = Field(default=DEFAULT_ALMANAC_ROOT)
    registered_at: datetime

    @property
    def almanac_path(self) -> Path:
        return self.root_path / self.almanac_root


class Repository(CodeAlmanacModel):
    repository_id: str
    name: RepositoryName
    description: str
    root_path: Path
    almanac_root: Path = Field(default=DEFAULT_ALMANAC_ROOT)
    almanac_path: Path
    registered_at: datetime

    @field_validator("repository_id")
    @classmethod
    def require_repository_id(cls, value: str) -> str:
        return required_text(value, "repository_id")

    @field_validator("almanac_root")
    @classmethod
    def validate_almanac_root(cls, value: Path) -> Path:
        return require_default_almanac_root(value)

    @model_validator(mode="after")
    def validate_almanac_path_matches_root(self) -> "Repository":
        expected = self.root_path / self.almanac_root
        if self.almanac_path != expected:
            raise ValueError(
                "repository almanac_path must match root_path/almanac_root"
            )
        return self


class RepositoryRecord(CodeAlmanacModel):
    name: RepositoryName
    description: str = ""
    path: Path
    almanac_root: Path = Field(default=DEFAULT_ALMANAC_ROOT)
    registered_at: datetime
    repository_id: str

    @field_validator("almanac_root")
    @classmethod
    def validate_almanac_root(cls, value: Path) -> Path:
        return require_default_almanac_root(value)

    def to_repository(self) -> Repository:
        return Repository(
            repository_id=self.repository_id,
            name=self.name,
            description=self.description,
            root_path=self.path,
            almanac_root=self.almanac_root,
            almanac_path=self.path / self.almanac_root,
            registered_at=self.registered_at,
        )


class RepositoryState(StrEnum):
    AVAILABLE = "available"
    MISSING_REPO = "missing_repo"
    MISSING_ALMANAC = "missing_almanac"


class RegisteredRepository(CodeAlmanacModel):
    repository: Repository
    state: RepositoryState


class RegisteredRepositories(CodeAlmanacModel):
    repositories: tuple[RegisteredRepository, ...]


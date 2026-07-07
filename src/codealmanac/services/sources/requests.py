from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.sources.models import SourceRef, TranscriptApp


class ResolveSourcesRequest(CodeAlmanacModel):
    cwd: Path
    inputs: tuple[str, ...]

    @field_validator("inputs")
    @classmethod
    def require_inputs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) == 0:
            raise ValueError("at least one source input is required")
        return value


class DiscoverTranscriptsRequest(CodeAlmanacModel):
    home: Path
    apps: tuple[TranscriptApp, ...]

    @field_validator("apps")
    @classmethod
    def require_apps(
        cls,
        value: tuple[TranscriptApp, ...],
    ) -> tuple[TranscriptApp, ...]:
        if len(value) == 0:
            raise ValueError("at least one transcript app is required")
        return value


class SourceRuntimeContext(CodeAlmanacModel):
    ignored_directories: tuple[Path, ...] = ()

    @field_validator("ignored_directories")
    @classmethod
    def validate_ignored_directories(
        cls,
        value: tuple[Path, ...],
    ) -> tuple[Path, ...]:
        directories: list[Path] = []
        for directory in value:
            normalized = normalize_ignored_directory(directory)
            if normalized not in directories:
                directories.append(normalized)
        return tuple(directories)


class InspectSourceRuntimeRequest(CodeAlmanacModel):
    cwd: Path
    ref: SourceRef
    context: SourceRuntimeContext = Field(default_factory=SourceRuntimeContext)


def normalize_ignored_directory(path: Path) -> Path:
    if path.is_absolute():
        raise ValueError("source runtime ignored directories must be repo-relative")
    if len(path.parts) == 0:
        raise ValueError("source runtime ignored directories must name a directory")
    if any(part in {"..", "~"} for part in path.parts):
        raise ValueError("source runtime ignored directories must stay inside the repo")
    return Path(*path.parts)

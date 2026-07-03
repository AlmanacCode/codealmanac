from enum import StrEnum
from pathlib import Path

from pydantic import Field, field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text


class ManualDocumentName(StrEnum):
    README = "README.md"
    HOW_TO_WRITE = "how-to-write.md"
    EVIDENCE = "evidence.md"
    LINKS = "links.md"
    CONCEPTS = "concepts.md"
    ARCHITECTURE = "architecture.md"
    HOW_TO_GUIDES = "how-to-guides.md"
    DECISIONS = "decisions.md"
    REFERENCE = "reference.md"
    SOURCES = "sources.md"
    INGEST = "ingest.md"
    GARDEN = "garden.md"


MANUAL_DOCUMENTS: tuple[ManualDocumentName, ...] = (
    ManualDocumentName.README,
    ManualDocumentName.HOW_TO_WRITE,
    ManualDocumentName.EVIDENCE,
    ManualDocumentName.LINKS,
    ManualDocumentName.CONCEPTS,
    ManualDocumentName.ARCHITECTURE,
    ManualDocumentName.HOW_TO_GUIDES,
    ManualDocumentName.DECISIONS,
    ManualDocumentName.REFERENCE,
    ManualDocumentName.SOURCES,
    ManualDocumentName.INGEST,
    ManualDocumentName.GARDEN,
)


class ManualDocument(CodeAlmanacModel):
    name: ManualDocumentName
    relative_path: str
    body: str

    @field_validator("relative_path")
    @classmethod
    def require_relative_path(cls, value: str) -> str:
        text = required_text(value, "manual path")
        if text.startswith("/") or "/../" in f"/{text}/":
            raise ValueError("manual path must be relative")
        return text

    @field_validator("body")
    @classmethod
    def require_body(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("manual body must not be empty")
        return value


class ManualInventory(CodeAlmanacModel):
    documents: tuple[ManualDocument, ...] = Field(min_length=1)


class ManualInstallResult(CodeAlmanacModel):
    target_path: Path
    copied: tuple[str, ...]
    existing: tuple[str, ...]

    @field_validator("copied", "existing")
    @classmethod
    def require_paths(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return tuple(required_text(path, "manual path") for path in value)


class ManualWorkspaceStatus(CodeAlmanacModel):
    target_path: Path
    expected: tuple[str, ...] = Field(min_length=1)
    present: tuple[str, ...]
    missing: tuple[str, ...]
    changed: tuple[str, ...] = ()

    @property
    def complete(self) -> bool:
        return len(self.missing) == 0

    @field_validator("expected", "present", "missing", "changed")
    @classmethod
    def require_paths(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return tuple(required_text(path, "manual path") for path in value)

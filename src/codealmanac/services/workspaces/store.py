import json
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import TypeAdapter, ValidationError

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.paths import normalize_path
from codealmanac.services.workspaces.identity import workspace_id_for
from codealmanac.services.workspaces.models import (
    Workspace,
    WorkspaceRegistryEntry,
)
from codealmanac.services.workspaces.selection import same_path


class WorkspaceRegistryStore:
    def __init__(self, path: Path):
        self.path = normalize_path(path)

    def remember(self, workspace: Workspace) -> WorkspaceRegistryEntry:
        entries = [
            entry
            for entry in self.list()
            if not same_workspace(entry, workspace)
        ]
        entry = registry_entry_for(workspace)
        entries.append(entry)
        write_entries(self.path, entries)
        return entry

    def replace(self, entries: Sequence[WorkspaceRegistryEntry]) -> None:
        write_entries(self.path, list(entries))

    def find_by_workspace_id(self, workspace_id: str) -> WorkspaceRegistryEntry | None:
        for entry in self.list():
            if entry.workspace_id == workspace_id:
                return entry
        return None

    def list(self) -> list[WorkspaceRegistryEntry]:
        if not self.path.exists():
            return []
        text = self.path.read_text(encoding="utf-8").strip()
        if text == "":
            return []
        return parse_entries(text)


def registry_entry_for(workspace: Workspace) -> WorkspaceRegistryEntry:
    return WorkspaceRegistryEntry(
        name=workspace.name,
        description=workspace.description,
        path=workspace.root_path,
        almanac_root=workspace.almanac_root,
        registered_at=workspace.registered_at,
        workspace_id=workspace.workspace_id,
    )


def same_workspace(entry: WorkspaceRegistryEntry, workspace: Workspace) -> bool:
    return (
        entry.workspace_id == workspace.workspace_id
        or same_path(entry.path, workspace.root_path)
        or entry.name.casefold() == workspace.name.casefold()
    )


def write_entries(path: Path, entries: list[WorkspaceRegistryEntry]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = entries_adapter().dump_python(entries, mode="json")
    temporary = temporary_registry_path(path)
    temporary.write_text(f"{json.dumps(data, indent=2)}\n", encoding="utf-8")
    temporary.replace(path)


def temporary_registry_path(path: Path) -> Path:
    return path.with_name(f".{path.name}.{uuid4().hex}.tmp")


def parse_entries(text: str) -> list[WorkspaceRegistryEntry]:
    try:
        raw_entries = json.loads(text)
    except json.JSONDecodeError as error:
        message = f"workspace registry is invalid JSON: {error}"
        raise ValidationFailed(message) from error
    if not isinstance(raw_entries, list):
        raise ValidationFailed("workspace registry must be a JSON array")
    return [parse_entry(raw_entry) for raw_entry in raw_entries]


def parse_entry(raw_entry: Any) -> WorkspaceRegistryEntry:
    if not isinstance(raw_entry, dict):
        raise ValidationFailed("workspace registry entries must be objects")
    upgraded = dict(raw_entry)
    if "path" not in upgraded:
        raise ValidationFailed('workspace registry entry is missing "path"')
    path = normalize_path(Path(str(upgraded["path"])))
    upgraded["path"] = path
    if "workspace_id" not in upgraded:
        upgraded["workspace_id"] = workspace_id_for_path(path)
    if "description" not in upgraded:
        upgraded["description"] = ""
    if "almanac_root" not in upgraded:
        upgraded["almanac_root"] = "almanac"
    if "registered_at" not in upgraded or upgraded["registered_at"] == "":
        upgraded["registered_at"] = datetime.now(UTC).isoformat()
    try:
        return WorkspaceRegistryEntry.model_validate(upgraded)
    except ValidationError as error:
        message = f"workspace registry entry is invalid: {error}"
        raise ValidationFailed(message) from error


def entries_adapter() -> TypeAdapter[Sequence[WorkspaceRegistryEntry]]:
    return TypeAdapter(Sequence[WorkspaceRegistryEntry])


def workspace_id_for_path(path: Path) -> str:
    return workspace_id_for(path)

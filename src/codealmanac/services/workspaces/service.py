from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path

from codealmanac.core.errors import ConflictError, NotFoundError, ValidationFailed
from codealmanac.core.paths import nearest_almanac_root, normalize_path
from codealmanac.core.slug import to_kebab_case
from codealmanac.services.workspaces.models import Workspace, WorkspaceRegistryEntry
from codealmanac.services.workspaces.requests import (
    RegisterWorkspaceRequest,
    SelectWorkspaceRequest,
)
from codealmanac.services.workspaces.store import WorkspaceRegistryStore


class WorkspacesService:
    def __init__(self, store: WorkspaceRegistryStore):
        self.store = store

    def initialization_root(self, path: Path) -> Path:
        normalized = normalize_path(path)
        if normalized.is_file():
            normalized = normalized.parent
        existing = nearest_almanac_root(normalized)
        return existing or normalized

    def register(self, request: RegisterWorkspaceRequest) -> Workspace:
        root_path = normalize_path(request.root_path)
        name = workspace_name_for(root_path, request.name)
        workspace = Workspace(
            workspace_id=workspace_id_for(root_path),
            name=name,
            description=request.description.strip(),
            root_path=root_path,
            almanac_path=root_path / ".almanac",
            registered_at=datetime.now(UTC),
        )
        return self.store.remember(workspace).to_workspace()

    def get(self, workspace_id: str) -> Workspace:
        entry = self.store.find_by_workspace_id(workspace_id)
        if entry is None:
            raise NotFoundError("workspace", workspace_id)
        return entry.to_workspace()

    def select(self, request: SelectWorkspaceRequest) -> Workspace:
        entries = self.store.list()
        selected = entry_by_workspace_id(request.selector, entries)
        if selected is not None:
            return selected.to_workspace()
        selected = entry_by_name(request.selector, entries)
        if selected is not None:
            return selected.to_workspace()
        selected = entry_by_path(request, entries)
        if selected is not None:
            return selected.to_workspace()
        raise NotFoundError("workspace", request.selector)

    def resolve(self, path: Path) -> Workspace:
        normalized = normalize_path(path)
        selected = containing_workspace(normalized, self.list())
        if selected is not None:
            return selected
        root_path = nearest_almanac_root(normalized)
        if root_path is None:
            raise NotFoundError("workspace", str(path))
        return self.register(RegisterWorkspaceRequest(root_path=root_path))

    def validate_path(self, workspace_id: str, path: Path) -> Path:
        workspace = self.get(workspace_id)
        normalized = normalize_path(path)
        if not contains_path(workspace.root_path, normalized):
            raise ValidationFailed(
                f"path is outside workspace {workspace.name}: {normalized}"
            )
        return normalized

    def list(self) -> list[Workspace]:
        return [entry.to_workspace() for entry in self.store.list()]

    @property
    def registry_path(self) -> Path:
        return self.store.path


def workspace_name_for(root_path: Path, requested_name: str | None) -> str:
    name = to_kebab_case(requested_name or root_path.name)
    if not name:
        raise ValidationFailed("could not derive a workspace name; pass --name")
    return name


def workspace_id_for(root_path: Path) -> str:
    digest = sha256(str(root_path).encode("utf-8")).hexdigest()[:16]
    return f"w_{digest}"


def entry_by_workspace_id(
    selector: str,
    entries: list[WorkspaceRegistryEntry],
) -> WorkspaceRegistryEntry | None:
    for entry in entries:
        if entry.workspace_id == selector:
            return entry
    return None


def entry_by_name(
    selector: str,
    entries: list[WorkspaceRegistryEntry],
) -> WorkspaceRegistryEntry | None:
    matches = [
        entry
        for entry in entries
        if entry.name.casefold() == selector.casefold()
    ]
    if len(matches) > 1:
        raise ConflictError(f"workspace selector is ambiguous: {selector}")
    if len(matches) == 1:
        return matches[0]
    return None


def entry_by_path(
    request: SelectWorkspaceRequest,
    entries: list[WorkspaceRegistryEntry],
) -> WorkspaceRegistryEntry | None:
    selector_path = explicit_selector_path(request)
    if selector_path is None:
        return None
    for entry in entries:
        if same_path(entry.path, selector_path):
            return entry
    return None


def explicit_selector_path(request: SelectWorkspaceRequest) -> Path | None:
    if not is_path_selector(request.selector):
        return None
    path = Path(request.selector).expanduser()
    if path.is_absolute():
        return normalize_path(path)
    if request.base_path is None:
        return None
    return normalize_path(request.base_path / path)


def is_path_selector(selector: str) -> bool:
    return selector.startswith(("/", "~", ".")) or "/" in selector


def containing_workspace(path: Path, workspaces: list[Workspace]) -> Workspace | None:
    matches = [
        workspace
        for workspace in workspaces
        if contains_path(workspace.root_path, path)
    ]
    if len(matches) == 0:
        return None
    return max(matches, key=lambda workspace: len(workspace.root_path.parts))


def contains_path(root_path: Path, path: Path) -> bool:
    return path == root_path or root_path in path.parents


def same_path(left: Path, right: Path) -> bool:
    return normalize_path(left) == normalize_path(right)

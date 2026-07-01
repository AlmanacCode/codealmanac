from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.errors import NotFoundError, ValidationFailed
from codealmanac.core.paths import normalize_path
from codealmanac.services.workspaces.identity import (
    workspace_id_for,
    workspace_name_for,
)
from codealmanac.services.workspaces.models import (
    DropWorkspaceResult,
    Workspace,
    WorkspaceListItem,
    WorkspaceListResult,
)
from codealmanac.services.workspaces.requests import (
    DropWorkspaceRequest,
    RegisterWorkspaceRequest,
    SelectWorkspaceRequest,
)
from codealmanac.services.workspaces.roots import (
    DEFAULT_ALMANAC_ROOT,
    AlmanacRootMatch,
    nearest_almanac_root,
)
from codealmanac.services.workspaces.selection import (
    containing_workspace,
    contains_path,
    entry_by_exact_path,
    select_registry_entry,
)
from codealmanac.services.workspaces.status import (
    available_registry_entries,
    unavailable_registry_entries,
    workspace_registry_status,
)
from codealmanac.services.workspaces.store import WorkspaceRegistryStore


class WorkspacesService:
    def __init__(self, store: WorkspaceRegistryStore):
        self.store = store

    def initialization_target(
        self,
        path: Path,
        almanac_root: Path | None,
    ) -> AlmanacRootMatch:
        normalized = normalize_path(path)
        if normalized.is_file():
            normalized = normalized.parent
        if almanac_root is None:
            selected = containing_workspace(normalized, self.list())
            if selected is not None:
                return AlmanacRootMatch(
                    repo_root=selected.root_path,
                    almanac_root=selected.almanac_root,
                    almanac_path=selected.almanac_path,
                )
            almanac_root = DEFAULT_ALMANAC_ROOT
        existing = nearest_almanac_root(normalized, (almanac_root,))
        if existing is not None:
            return existing
        return AlmanacRootMatch(
            repo_root=normalized,
            almanac_root=almanac_root,
            almanac_path=normalized / almanac_root,
        )

    def register(self, request: RegisterWorkspaceRequest) -> Workspace:
        root_path = normalize_path(request.root_path)
        almanac_path = root_path / request.almanac_root
        existing = entry_by_exact_path(root_path, self.store.list())
        name = workspace_name_for(
            root_path,
            request.name or (existing.name if existing is not None else None),
        )
        description = (
            request.description.strip()
            or (existing.description if existing is not None else "")
        )
        workspace = Workspace(
            workspace_id=workspace_id_for(root_path),
            name=name,
            description=description,
            root_path=root_path,
            almanac_root=request.almanac_root,
            almanac_path=almanac_path,
            registered_at=(
                existing.registered_at if existing is not None else datetime.now(UTC)
            ),
        )
        return self.store.remember(workspace).to_workspace()

    def get(self, workspace_id: str) -> Workspace:
        entry = self.store.find_by_workspace_id(workspace_id)
        if entry is None:
            raise NotFoundError("workspace", workspace_id)
        return entry.to_workspace()

    def select(self, request: SelectWorkspaceRequest) -> Workspace:
        entries = self.store.list()
        selected = select_registry_entry(request, entries)
        if selected is not None:
            return selected.to_workspace()
        raise NotFoundError("workspace", request.selector)

    def resolve(self, path: Path) -> Workspace:
        normalized = normalize_path(path)
        selected = containing_workspace(normalized, self.list())
        if selected is not None:
            return selected
        match = nearest_almanac_root(normalized, self.discoverable_almanac_roots())
        if match is None:
            raise NotFoundError("workspace", str(path))
        return self.register(
            RegisterWorkspaceRequest(
                root_path=match.repo_root,
                almanac_root=match.almanac_root,
            )
        )

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

    def list_registry(self) -> WorkspaceListResult:
        return WorkspaceListResult(
            items=tuple(
                WorkspaceListItem(
                    workspace=entry.to_workspace(),
                    status=workspace_registry_status(entry.to_workspace()),
                )
                for entry in self.store.list()
            )
        )

    def drop(self, request: DropWorkspaceRequest) -> DropWorkspaceResult:
        entries = self.store.list()
        selected = select_registry_entry(
            SelectWorkspaceRequest(
                selector=request.selector,
                base_path=request.base_path,
            ),
            entries,
        )
        if selected is None:
            raise NotFoundError("workspace", request.selector)
        remaining = [
            entry
            for entry in entries
            if entry.workspace_id != selected.workspace_id
        ]
        self.store.replace(remaining)
        return DropWorkspaceResult(dropped=(selected.to_workspace(),))

    def drop_missing(self) -> DropWorkspaceResult:
        entries = self.store.list()
        dropped = tuple(
            entry.to_workspace()
            for entry in unavailable_registry_entries(entries)
        )
        remaining = available_registry_entries(entries)
        self.store.replace(remaining)
        return DropWorkspaceResult(dropped=dropped)

    def discoverable_almanac_roots(self) -> tuple[Path, ...]:
        roots = [DEFAULT_ALMANAC_ROOT]
        for workspace in self.list():
            if workspace.almanac_root not in roots:
                roots.append(workspace.almanac_root)
        return tuple(roots)

    @property
    def registry_path(self) -> Path:
        return self.store.path

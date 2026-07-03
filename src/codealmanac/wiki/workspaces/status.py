from codealmanac.wiki.workspaces.models import (
    Workspace,
    WorkspaceRegistryEntry,
    WorkspaceRegistryStatus,
)
from codealmanac.wiki.workspaces.roots import is_initialized_almanac_root


def workspace_registry_status(workspace: Workspace) -> WorkspaceRegistryStatus:
    if not workspace.root_path.is_dir():
        return WorkspaceRegistryStatus.MISSING_REPO
    if not is_initialized_almanac_root(workspace.almanac_path):
        return WorkspaceRegistryStatus.MISSING_ALMANAC
    return WorkspaceRegistryStatus.AVAILABLE


def workspace_has_initialized_root(workspace: Workspace) -> bool:
    return workspace_registry_status(workspace) == WorkspaceRegistryStatus.AVAILABLE


def available_registry_entries(
    entries: list[WorkspaceRegistryEntry],
) -> list[WorkspaceRegistryEntry]:
    return [
        entry
        for entry in entries
        if entry_status(entry) == WorkspaceRegistryStatus.AVAILABLE
    ]


def unavailable_registry_entries(
    entries: list[WorkspaceRegistryEntry],
) -> list[WorkspaceRegistryEntry]:
    return [
        entry
        for entry in entries
        if entry_status(entry) != WorkspaceRegistryStatus.AVAILABLE
    ]


def entry_status(entry: WorkspaceRegistryEntry) -> WorkspaceRegistryStatus:
    return workspace_registry_status(entry.to_workspace())

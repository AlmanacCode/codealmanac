from pathlib import Path

from codealmanac.core.errors import ConflictError
from codealmanac.core.paths import normalize_path
from codealmanac.wiki.workspaces.models import Workspace, WorkspaceRegistryEntry
from codealmanac.wiki.workspaces.requests import SelectWorkspaceRequest


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
        entry for entry in entries if entry.name.casefold() == selector.casefold()
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


def select_registry_entry(
    request: SelectWorkspaceRequest,
    entries: list[WorkspaceRegistryEntry],
) -> WorkspaceRegistryEntry | None:
    selected = entry_by_workspace_id(request.selector, entries)
    if selected is not None:
        return selected
    selected = entry_by_name(request.selector, entries)
    if selected is not None:
        return selected
    return entry_by_path(request, entries)


def entry_by_exact_path(
    path: Path,
    entries: list[WorkspaceRegistryEntry],
) -> WorkspaceRegistryEntry | None:
    for entry in entries:
        if same_path(entry.path, path):
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

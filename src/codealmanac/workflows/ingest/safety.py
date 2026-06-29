from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.services.workspaces.models import (
    Workspace,
    WorkspaceChangeSnapshot,
    WorkspacePathChange,
)
from codealmanac.services.workspaces.ports import WorkspaceChangeProbe
from codealmanac.workflows.ingest.models import (
    IngestMutationPreflight,
    IngestMutationReport,
)


class IngestMutationPolicy:
    def __init__(self, probe: WorkspaceChangeProbe):
        self.probe = probe

    def preflight(self, workspace: Workspace) -> IngestMutationPreflight:
        before = self.probe.snapshot(workspace.root_path)
        validate_snapshot_available(before)
        almanac_prefix = almanac_relative_path(workspace)
        dirty_almanac = tuple(
            change.path
            for change in before.changes
            if path_is_under(change.path, almanac_prefix)
        )
        if dirty_almanac:
            raise ValidationFailed(
                "ingest requires a clean .almanac before running: "
                f"{format_paths(dirty_almanac)}"
            )
        return IngestMutationPreflight(
            before=before,
            almanac_prefix=almanac_prefix,
        )

    def validate(
        self,
        preflight: IngestMutationPreflight,
        workspace: Workspace,
        reported_changed_files: tuple[Path, ...],
    ) -> IngestMutationReport:
        validate_reported_changes(workspace, reported_changed_files)
        after = self.probe.snapshot(workspace.root_path)
        validate_snapshot_available(after)
        mutated = changed_paths(preflight.before, after)
        unsafe = tuple(
            path
            for path in mutated
            if not path_is_under(path, preflight.almanac_prefix)
        )
        if unsafe:
            raise ValidationFailed(
                "ingest changed file outside .almanac: "
                f"{format_paths(unsafe)}"
            )
        return IngestMutationReport(
            before=preflight.before,
            after=after,
            changed_files=tuple(
                workspace.root_path / path
                for path in mutated
                if path_is_under(path, preflight.almanac_prefix)
            ),
        )


def validate_snapshot_available(snapshot: WorkspaceChangeSnapshot) -> None:
    if snapshot.available:
        return
    reason = snapshot.unavailable_reason or "unknown git status failure"
    raise ValidationFailed(f"ingest requires Git change tracking: {reason}")


def validate_reported_changes(
    workspace: Workspace,
    reported_changed_files: tuple[Path, ...],
) -> None:
    almanac_root = workspace.almanac_path.resolve()
    for changed_file in reported_changed_files:
        candidate = changed_file
        if not candidate.is_absolute():
            candidate = workspace.root_path / candidate
        try:
            candidate.resolve().relative_to(almanac_root)
        except ValueError as error:
            raise ValidationFailed(
                f"harness reported change outside .almanac: {changed_file}"
            ) from error


def changed_paths(
    before: WorkspaceChangeSnapshot,
    after: WorkspaceChangeSnapshot,
) -> tuple[Path, ...]:
    before_by_path = changes_by_path(before.changes)
    after_by_path = changes_by_path(after.changes)
    paths = set(before_by_path) | set(after_by_path)
    changed = [
        path
        for path in paths
        if change_identity(before_by_path.get(path))
        != change_identity(after_by_path.get(path))
    ]
    return tuple(sorted(changed, key=lambda item: item.as_posix()))


def changes_by_path(
    changes: tuple[WorkspacePathChange, ...],
) -> dict[Path, WorkspacePathChange]:
    return {change.path: change for change in changes}


def change_identity(
    change: WorkspacePathChange | None,
) -> tuple[str, str, str | None] | None:
    if change is None:
        return None
    return (change.state.value, change.status, change.fingerprint)


def almanac_relative_path(workspace: Workspace) -> Path:
    try:
        return workspace.almanac_path.resolve().relative_to(
            workspace.root_path.resolve()
        )
    except ValueError as error:
        raise ValidationFailed(
            f".almanac path is outside workspace: {workspace.almanac_path}"
        ) from error


def path_is_under(path: Path, parent: Path) -> bool:
    return path == parent or parent in path.parents


def format_paths(paths: tuple[Path, ...]) -> str:
    return ", ".join(path.as_posix() for path in paths)

from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.repositories.models import (
    Repository,
)
from codealmanac.services.runs.models import RunKind
from codealmanac.workflows.change_tracking import (
    RepositoryChangeProbe,
    RepositoryChangeSnapshot,
    RepositoryPathChange,
)


class LifecycleMutationPreflight(CodeAlmanacModel):
    before: RepositoryChangeSnapshot
    almanac_prefix: Path


class LifecycleMutationReport(CodeAlmanacModel):
    before: RepositoryChangeSnapshot
    after: RepositoryChangeSnapshot
    changed_files: tuple[Path, ...]


class LifecycleMutationPolicy:
    def __init__(self, probe: RepositoryChangeProbe, kind: RunKind):
        self.probe = probe
        self.kind = kind

    def preflight(self, repository: Repository) -> LifecycleMutationPreflight:
        before = self.probe.snapshot(repository.root_path)
        validate_snapshot_available(before, self.kind)
        almanac_prefix = almanac_relative_path(repository)
        return LifecycleMutationPreflight(
            before=before,
            almanac_prefix=almanac_prefix,
        )

    def ensure_tracking_available(self, root_path: Path) -> None:
        validate_snapshot_available(self.probe.snapshot(root_path), self.kind)

    def validate(
        self,
        preflight: LifecycleMutationPreflight,
        repository: Repository,
        reported_changed_files: tuple[Path, ...],
    ) -> LifecycleMutationReport:
        validate_reported_changes(repository, reported_changed_files)
        after = self.probe.snapshot(repository.root_path)
        validate_snapshot_available(after, self.kind)
        mutated = changed_paths(preflight.before, after)
        unsafe = tuple(
            path
            for path in mutated
            if not path_is_under(path, preflight.almanac_prefix)
        )
        if unsafe:
            almanac_label = preflight.almanac_prefix.as_posix()
            raise ValidationFailed(
                f"{self.kind} changed file outside {almanac_label}: "
                f"{format_paths(unsafe)}"
            )
        return LifecycleMutationReport(
            before=preflight.before,
            after=after,
            changed_files=tuple(
                repository.root_path / path
                for path in mutated
                if path_is_under(path, preflight.almanac_prefix)
            ),
        )


def validate_snapshot_available(
    snapshot: RepositoryChangeSnapshot,
    kind: RunKind,
) -> None:
    if snapshot.available:
        return
    reason = snapshot.unavailable_reason or "unknown git status failure"
    raise ValidationFailed(f"{kind} requires Git change tracking: {reason}")


def validate_reported_changes(
    repository: Repository,
    reported_changed_files: tuple[Path, ...],
) -> None:
    almanac_root = repository.almanac_path.resolve()
    for changed_file in reported_changed_files:
        candidate = changed_file
        if not candidate.is_absolute():
            candidate = repository.root_path / candidate
        try:
            candidate.resolve().relative_to(almanac_root)
        except ValueError as error:
            raise ValidationFailed(
                "harness reported change outside almanac/: "
                f"{changed_file}"
            ) from error


def changed_paths(
    before: RepositoryChangeSnapshot,
    after: RepositoryChangeSnapshot,
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
    changes: tuple[RepositoryPathChange, ...],
) -> dict[Path, RepositoryPathChange]:
    return {change.path: change for change in changes}


def change_identity(
    change: RepositoryPathChange | None,
) -> tuple[str, str, str | None] | None:
    if change is None:
        return None
    return (change.state.value, change.status, change.fingerprint)


def almanac_relative_path(repository: Repository) -> Path:
    try:
        return repository.almanac_path.resolve().relative_to(
            repository.root_path.resolve()
        )
    except ValueError as error:
        raise ValidationFailed(
            f"Almanac root is outside repository: {repository.almanac_path}"
        ) from error


def path_is_under(path: Path, parent: Path) -> bool:
    return path == parent or parent in path.parents


def format_paths(paths: tuple[Path, ...]) -> str:
    return ", ".join(path.as_posix() for path in paths)

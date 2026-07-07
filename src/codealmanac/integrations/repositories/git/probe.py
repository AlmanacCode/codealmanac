import hashlib
import subprocess
from pathlib import Path

from codealmanac.workflows.change_tracking import (
    RepositoryChangeSnapshot,
    RepositoryPathChange,
    RepositoryPathState,
)

GIT_STATUS_TIMEOUT_SECONDS = 10


class GitRepositoryChangeProbe:
    def snapshot(self, root_path: Path) -> RepositoryChangeSnapshot:
        try:
            completed = subprocess.run(
                (
                    "git",
                    "-C",
                    str(root_path),
                    "status",
                    "--porcelain=v1",
                    "-z",
                    "--untracked-files=all",
                ),
                text=True,
                capture_output=True,
                timeout=GIT_STATUS_TIMEOUT_SECONDS,
                check=False,
            )
        except FileNotFoundError:
            return unavailable_snapshot(root_path, "git not found on PATH")
        except subprocess.TimeoutExpired:
            return unavailable_snapshot(root_path, "git status timed out")
        if completed.returncode != 0:
            return unavailable_snapshot(
                root_path,
                first_line(completed.stderr, completed.stdout)
                or f"git status exited {completed.returncode}",
            )
        return RepositoryChangeSnapshot(
            root_path=root_path,
            available=True,
            changes=tuple(
                change_with_fingerprint(root_path, change)
                for change in parse_git_status(completed.stdout)
            ),
        )


def unavailable_snapshot(root_path: Path, reason: str) -> RepositoryChangeSnapshot:
    return RepositoryChangeSnapshot(
        root_path=root_path,
        available=False,
        unavailable_reason=reason,
    )


def parse_git_status(value: str) -> tuple[RepositoryPathChange, ...]:
    changes: list[RepositoryPathChange] = []
    fields = [field for field in value.split("\0") if field]
    skip_next = False
    for field in fields:
        if skip_next:
            skip_next = False
            continue
        if len(field) < 4:
            continue
        status = field[:2]
        path = Path(field[3:])
        changes.append(
            RepositoryPathChange(
                path=path,
                state=state_from_status(status),
                status=status,
            )
        )
        if "R" in status or "C" in status:
            skip_next = True
    return tuple(changes)


def state_from_status(status: str) -> RepositoryPathState:
    if "?" in status:
        return RepositoryPathState.UNTRACKED
    if "U" in status:
        return RepositoryPathState.UNMERGED
    if "R" in status:
        return RepositoryPathState.RENAMED
    if "C" in status:
        return RepositoryPathState.COPIED
    if "D" in status:
        return RepositoryPathState.DELETED
    if "A" in status:
        return RepositoryPathState.ADDED
    if "M" in status:
        return RepositoryPathState.MODIFIED
    if "T" in status:
        return RepositoryPathState.TYPE_CHANGED
    return RepositoryPathState.UNKNOWN


def change_with_fingerprint(
    root_path: Path,
    change: RepositoryPathChange,
) -> RepositoryPathChange:
    return change.model_copy(
        update={"fingerprint": file_fingerprint(root_path / change.path)}
    )


def file_fingerprint(path: Path) -> str | None:
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def first_line(*values: str) -> str:
    for value in values:
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        if lines:
            return lines[0]
    return ""

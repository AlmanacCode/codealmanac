from pathlib import Path

from codealmanac.integrations.repositories.git.probe import (
    parse_git_status,
    state_from_status,
)
from codealmanac.workflows.change_tracking import RepositoryPathState


def test_parse_git_status_handles_renames_and_untracked_paths():
    changes = parse_git_status("R  new.md\0old.md\0?? docs/note.md\0")

    assert tuple(change.path for change in changes) == (
        Path("new.md"),
        Path("docs/note.md"),
    )
    assert tuple(change.state for change in changes) == (
        RepositoryPathState.RENAMED,
        RepositoryPathState.UNTRACKED,
    )


def test_state_from_status_maps_common_porcelain_states():
    assert state_from_status(" M") == RepositoryPathState.MODIFIED
    assert state_from_status("A ") == RepositoryPathState.ADDED
    assert state_from_status(" D") == RepositoryPathState.DELETED
    assert state_from_status("??") == RepositoryPathState.UNTRACKED

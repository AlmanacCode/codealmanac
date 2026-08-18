from pathlib import Path, PurePosixPath, PureWindowsPath

import pytest
from pydantic import ValidationError

from codealmanac.core.paths import is_rooted
from codealmanac.services.repositories.roots import require_default_almanac_root
from codealmanac.services.sources.requests import SourceRuntimeContext


@pytest.mark.parametrize(
    "raw",
    ("/tmp/wiki", "C:/abs/wiki", "C:wiki", "//server/share/wiki"),
)
def test_windows_anchored_paths_are_rooted(raw: str):
    assert is_rooted(PureWindowsPath(raw)) is True


@pytest.mark.parametrize("raw", ("wiki", "docs/wiki", "../wiki", "./wiki"))
def test_windows_relative_paths_are_not_rooted(raw: str):
    assert is_rooted(PureWindowsPath(raw)) is False


@pytest.mark.parametrize("raw", ("/tmp/wiki", "/"))
def test_posix_absolute_paths_are_rooted(raw: str):
    assert is_rooted(PurePosixPath(raw)) is True


@pytest.mark.parametrize("raw", ("wiki", "docs/wiki", "../wiki", "C:wiki"))
def test_posix_relative_paths_are_not_rooted(raw: str):
    # "C:wiki" is an ordinary relative filename on POSIX, so the guard must not
    # borrow Windows drive semantics on platforms that have no drives.
    assert is_rooted(PurePosixPath(raw)) is False


def test_rooted_paths_discard_the_repo_root_when_joined():
    repo = PureWindowsPath("C:/repo")

    assert repo / PureWindowsPath("/tmp/wiki") == PureWindowsPath("C:/tmp/wiki")
    assert repo / PureWindowsPath("D:/wiki") == PureWindowsPath("D:/wiki")


def test_source_runtime_context_rejects_rooted_ignored_directory():
    with pytest.raises(ValidationError):
        SourceRuntimeContext(ignored_directories=(Path("/tmp/wiki"),))


def test_almanac_root_rejects_rooted_path():
    with pytest.raises(ValueError):
        require_default_almanac_root(Path("/tmp/almanac"))

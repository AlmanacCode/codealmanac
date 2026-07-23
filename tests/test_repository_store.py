from datetime import UTC, datetime
from pathlib import Path

import pytest

from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.store import RepositoryStore


def test_repository_store_remembers_repository(tmp_path: Path):
    store = RepositoryStore(tmp_path / "codealmanac.db")
    root = tmp_path / "repo"
    repository = Repository(
        repository_id="repo-1",
        name="repo",
        description="Test repository",
        root_path=root,
        almanac_root=Path("almanac"),
        almanac_path=root / "almanac",
        registered_at=datetime(2026, 7, 6, tzinfo=UTC),
    )

    stored = store.remember(repository)

    assert stored.to_repository() == repository
    assert store.find_by_repository_id("repo-1") == stored
    assert store.list() == [stored]


def test_repository_name_is_a_shared_pydantic_boundary(tmp_path: Path):
    repository = Repository(
        repository_id="repo-1",
        name="  repo  ",
        description="",
        root_path=tmp_path / "repo",
        almanac_root=Path("almanac"),
        almanac_path=tmp_path / "repo/almanac",
        registered_at=datetime(2026, 7, 6, tzinfo=UTC),
    )

    assert repository.name == "repo"
    with pytest.raises(ValueError):
        Repository(
            repository_id="repo-1",
            name="  ",
            description="",
            root_path=tmp_path / "repo",
            almanac_root=Path("almanac"),
            almanac_path=tmp_path / "repo/almanac",
            registered_at=datetime(2026, 7, 6, tzinfo=UTC),
        )


def test_repository_store_updates_existing_repository(tmp_path: Path):
    store = RepositoryStore(tmp_path / "codealmanac.db")
    first = Repository(
        repository_id="repo-1",
        name="repo-one",
        description="",
        root_path=tmp_path / "one",
        almanac_root=Path("almanac"),
        almanac_path=tmp_path / "one/almanac",
        registered_at=datetime(2026, 7, 6, tzinfo=UTC),
    )
    changed = Repository(
        repository_id="repo-1",
        name="repo-renamed",
        description="Updated",
        root_path=tmp_path / "one",
        almanac_root=Path("almanac"),
        almanac_path=tmp_path / "one/almanac",
        registered_at=datetime(2026, 7, 7, tzinfo=UTC),
    )

    store.remember(first)
    store.remember(changed)

    record = store.find_by_repository_id("repo-1")
    assert record is not None
    assert record.name == "repo-renamed"
    assert record.description == "Updated"
    assert record.registered_at == first.registered_at
    assert [item.repository_id for item in store.list()] == ["repo-1"]


def test_read_repository_at_registers_multiple_workspaces_under_same_project(tmp_path: Path):
    from codealmanac.services.repositories.requests import RegisterRepositoryRequest, SelectRepositoryRequest
    from codealmanac.services.repositories.roots import ALMANAC_ROOT_MARKER_FILE, ALMANAC_ROOT_MARKER_README
    from codealmanac.services.repositories.service import RepositoriesService

    dir_a = tmp_path / "work" / "a" / "lmfellow"
    dir_b = tmp_path / "work" / "b" / "lmfellow"
    for d in (dir_a, dir_b):
        almanac = d / "almanac"
        almanac.mkdir(parents=True, exist_ok=True)
        (almanac / ALMANAC_ROOT_MARKER_FILE).write_text("topics: []\n", encoding="utf-8")
        (almanac / ALMANAC_ROOT_MARKER_README).write_text("# Test\n", encoding="utf-8")

    service = RepositoriesService(RepositoryStore(tmp_path / "codealmanac.db"))
    # Register dir_a
    repo_a = service.register(RegisterRepositoryRequest(root_path=dir_a))
    assert repo_a.name == "lmfellow"
    assert repo_a.root_path == dir_a

    # Auto-register dir_b via read_repository_at
    repo_b = service.read_repository_at(dir_b)
    assert repo_b.name == "lmfellow"
    assert repo_b.root_path == dir_b

    # Verify select_for_read resolves preferred checkout by CWD
    selected_a = service.select_for_read(cwd=dir_a, repository_name="lmfellow")
    assert selected_a.root_path == dir_a

    selected_b = service.select_for_read(cwd=dir_b, repository_name="lmfellow")
    assert selected_b.root_path == dir_b



from pathlib import Path

from codealmanac.wiki.workspaces.store import temporary_registry_path


def test_temporary_registry_paths_are_unique(tmp_path: Path):
    registry_path = tmp_path / "registry.json"

    first = temporary_registry_path(registry_path)
    second = temporary_registry_path(registry_path)

    assert first != second
    assert first.parent == registry_path.parent
    assert second.parent == registry_path.parent
    assert first.name.startswith(".registry.json.")
    assert first.name.endswith(".tmp")

from pathlib import Path

from codealmanac.settings import AppConfig, LocalStatePaths


def test_local_state_paths_keep_implicit_config_with_database_path(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / ".codealmanac" / "codealmanac.db"

    paths = LocalStatePaths.from_config(AppConfig(database_path=database_path))

    assert paths.database_path == database_path.resolve(strict=False)
    assert paths.state_dir == database_path.parent.resolve(strict=False)
    assert paths.config_path == database_path.parent / "config.toml"


def test_local_state_paths_keep_explicit_config_path(tmp_path: Path) -> None:
    database_path = tmp_path / ".codealmanac" / "codealmanac.db"
    config_path = tmp_path / "config.toml"

    paths = LocalStatePaths.from_config(
        AppConfig(database_path=database_path, config_path=config_path)
    )

    assert paths.config_path == config_path.resolve(strict=False)

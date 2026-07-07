from pathlib import Path


def home_dir() -> Path:
    return Path.home()


def state_dir_for(home: Path) -> Path:
    return home / ".codealmanac"


def global_state_dir() -> Path:
    return state_dir_for(home_dir())


def logs_dir_for(home: Path) -> Path:
    return state_dir_for(home) / "logs"


def default_database_path() -> Path:
    return global_state_dir() / "codealmanac.db"


def default_config_path() -> Path:
    return global_state_dir() / "config.toml"


def normalize_path(path: Path) -> Path:
    return path.expanduser().resolve(strict=False)

from pathlib import Path


def home_dir() -> Path:
    return Path.home()


def state_dir_for(home: Path) -> Path:
    return home / ".codealmanac"


def global_state_dir() -> Path:
    return state_dir_for(home_dir())


def default_registry_path() -> Path:
    return global_state_dir() / "registry.json"


def default_config_path() -> Path:
    return global_state_dir() / "config.toml"


def default_control_db_path() -> Path:
    return global_state_dir() / "control.sqlite"


def default_run_artifacts_path() -> Path:
    return global_state_dir() / "runs"


def normalize_path(path: Path) -> Path:
    return path.expanduser().resolve(strict=False)

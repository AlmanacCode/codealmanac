from pathlib import Path, PurePath


def is_rooted(path: PurePath) -> bool:
    # `is_absolute()` is not a containment check on Windows. `PureWindowsPath`
    # treats "/tmp/x" as relative because it carries no drive, and "C:x" as
    # relative because it carries no root, yet joining either one discards the
    # left-hand side: `C:/repo` / `/tmp/x` is `C:/tmp/x`. A repo-relative guard
    # therefore has to reject every anchor, not just fully qualified paths.
    return path.is_absolute() or bool(path.drive) or bool(path.root)


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

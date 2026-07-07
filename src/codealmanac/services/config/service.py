from pathlib import Path

from codealmanac.core.errors import (
    NoRepositorySelected,
    NotFoundError,
    ValidationFailed,
)
from codealmanac.core.paths import normalize_path
from codealmanac.services.config.models import (
    CONTROLLED_HARNESS_MODELS,
    DEFAULT_HARNESS_MODELS,
    HARNESS_MODELS,
    ConfigEntry,
    ConfigKey,
    ConfigSetResult,
    UserConfig,
)
from codealmanac.services.config.requests import (
    GetConfigValueRequest,
    LoadConfigRequest,
    SetConfigValueRequest,
)
from codealmanac.services.config.store import ConfigStore
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.repositories.service import RepositoriesService

PROJECT_CONFIG_NAME = "config.toml"


class ConfigService:
    def __init__(
        self,
        repositories: RepositoriesService,
        store: ConfigStore,
        user_config_path: Path,
    ):
        self.repositories = repositories
        self.store = store
        self.user_config_path = user_config_path

    def load(self, request: LoadConfigRequest) -> UserConfig:
        project_config_path = self.project_config_path(request)
        paths = config_source_paths(
            user_config_path=normalize_path(self.user_config_path),
            project_config_path=project_config_path,
        )
        return self.store.load(paths)

    def load_user(self) -> UserConfig:
        return self.store.load((normalize_path(self.user_config_path),))

    def list(self) -> tuple[ConfigEntry, ...]:
        config = self.load_user()
        return (
            ConfigEntry(
                key=ConfigKey.AUTO_COMMIT,
                value=format_bool(config.auto_commit),
            ),
            ConfigEntry(
                key=ConfigKey.HARNESS_DEFAULT,
                value=config.harness.default.value,
            ),
            ConfigEntry(
                key=ConfigKey.HARNESS_MODEL,
                value=config.harness.model,
            ),
        )

    def get(self, request: GetConfigValueRequest) -> ConfigEntry:
        entries = {entry.key: entry for entry in self.list()}
        return entries[request.key]

    def set(self, request: SetConfigValueRequest) -> ConfigSetResult:
        path = normalize_path(self.user_config_path)
        if request.key == ConfigKey.AUTO_COMMIT:
            normalized = parse_bool_value(request.value)
            self.store.set_value(path, None, "auto_commit", normalized)
        elif request.key == ConfigKey.HARNESS_DEFAULT:
            normalized_harness = parse_harness_value(request.value)
            normalized = normalized_harness
            self.store.set_value(path, "harness", "default", f'"{normalized}"')
            self.store.set_value(
                path,
                "harness",
                "model",
                f'"{DEFAULT_HARNESS_MODELS[HarnessKind(normalized)]}"',
            )
        elif request.key == ConfigKey.HARNESS_MODEL:
            config = self.load_user()
            normalized = parse_harness_model(request.value, config.harness.default)
            self.store.set_value(path, "harness", "model", f'"{normalized}"')
        else:
            raise AssertionError(f"unhandled config key: {request.key}")
        # Defense in depth: reject a write that leaves the config unloadable.
        self.store.load((path,))
        return ConfigSetResult(
            path=path.as_posix(),
            key=request.key,
            value=normalized,
        )

    def project_config_path(self, request: LoadConfigRequest) -> Path | None:
        try:
            repository = self.repositories.select_for_read(
                request.cwd,
                request.repository_name,
            )
        except (NoRepositorySelected, NotFoundError, OSError):
            return None
        return repository.almanac_path / PROJECT_CONFIG_NAME


def parse_bool_value(value: str) -> str:
    token = value.strip().lower()
    if token not in ("true", "false"):
        raise ValidationFailed("auto_commit must be true or false")
    return token


def parse_harness_value(value: str) -> str:
    token = value.strip().lower()
    kinds = tuple(kind.value for kind in HarnessKind)
    if token not in kinds:
        raise ValidationFailed(
            f"harness.default must be one of: {', '.join(kinds)}"
        )
    return token


def parse_harness_model(value: str, harness: HarnessKind) -> str:
    token = value.strip()
    if token not in CONTROLLED_HARNESS_MODELS:
        allowed = ", ".join(sorted(CONTROLLED_HARNESS_MODELS))
        raise ValidationFailed(f"harness.model must be one of: {allowed}")
    if token not in HARNESS_MODELS[harness]:
        allowed = ", ".join(HARNESS_MODELS[harness])
        raise ValidationFailed(
            f"harness.model for {harness.value} must be one of: {allowed}"
        )
    return token


def format_bool(value: bool) -> str:
    return "true" if value else "false"


def config_source_paths(
    user_config_path: Path,
    project_config_path: Path | None,
) -> tuple[Path, ...]:
    if project_config_path is None:
        return (user_config_path,)
    return (project_config_path, user_config_path)

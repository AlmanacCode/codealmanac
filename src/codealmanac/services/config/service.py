from datetime import timedelta
from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.paths import normalize_path
from codealmanac.services.automation.defaults import duration_text
from codealmanac.services.automation.models import (
    AutomationTask,
    AutomationTaskApplyResult,
)
from codealmanac.services.automation.requests import ReconcileAutomationTaskRequest
from codealmanac.services.automation.service import AutomationService
from codealmanac.services.config.models import (
    DEFAULT_HARNESS_MODELS,
    HARNESS_MODELS,
    OPENCODE_MODEL_SHAPE_MESSAGE,
    AutomationConfig,
    ConfigApplyResult,
    ConfigEntry,
    ConfigKey,
    ConfigSetResult,
    ConfigUpdateResult,
    TaskAutomationConfig,
    UserConfig,
    automation_entries,
    format_bool,
    is_opencode_model_shape,
    parse_duration,
)
from codealmanac.services.config.requests import (
    ApplyConfigRequest,
    GetConfigValueRequest,
    SetConfigValueRequest,
    UpdateUserConfigRequest,
)
from codealmanac.services.config.store import ConfigStore, TomlValueUpdate
from codealmanac.services.harnesses.models import HarnessKind


class ConfigService:
    def __init__(
        self,
        store: ConfigStore,
        user_config_path: Path,
        automation: AutomationService,
    ):
        self.store = store
        self.user_config_path = user_config_path
        self.automation = automation

    def load_user(self) -> UserConfig:
        return self.store.load(normalize_path(self.user_config_path))

    def list(self) -> tuple[ConfigEntry, ...]:
        return config_entries(self.load_user())

    def get(self, request: GetConfigValueRequest) -> ConfigEntry:
        entries = {entry.key: entry for entry in self.list()}
        return entries[request.key]

    def set(self, request: SetConfigValueRequest) -> ConfigSetResult:
        path = normalize_path(self.user_config_path)
        normalized, updates = config_value_updates(request, self.load_user())
        self.store.set_values(path, updates)
        config = self.load_user()
        task = automation_task_for_key(request.key)
        applied = None
        if task is not None:
            applied = self.reconcile_task(task, config.automation.for_task(task))
        return ConfigSetResult(
            path=path.as_posix(),
            key=request.key,
            value=normalized,
            automation=applied,
        )

    def update(self, request: UpdateUserConfigRequest) -> ConfigUpdateResult:
        path = normalize_path(self.user_config_path)
        self.store.set_values(path, user_config_updates(request))
        config = self.load_user()
        applied = self.reconcile_all(config.automation, request)
        return ConfigUpdateResult(
            path=path.as_posix(),
            entries=config_entries(config),
            automation=applied,
        )

    def apply(self, request: ApplyConfigRequest) -> ConfigApplyResult:
        path = normalize_path(self.user_config_path)
        config = self.load_user()
        return ConfigApplyResult(
            path=path.as_posix(),
            automation=self.reconcile_all(config.automation, request),
        )

    def reconcile_all(
        self,
        config: AutomationConfig,
        request: ApplyConfigRequest,
    ) -> tuple[AutomationTaskApplyResult, ...]:
        return tuple(
            self.reconcile_task(task, config.for_task(task), request)
            for task in AutomationTask
        )

    def reconcile_task(
        self,
        task: AutomationTask,
        settings: TaskAutomationConfig,
        context: ApplyConfigRequest | None = None,
    ) -> AutomationTaskApplyResult:
        context = context or ApplyConfigRequest()
        return self.automation.reconcile_task(
            ReconcileAutomationTaskRequest(
                task=task,
                enabled=settings.enabled,
                every=settings.every,
                home=context.home,
                env_path=context.env_path,
                codealmanac_executable=context.codealmanac_executable,
            )
        )


def config_entries(config: UserConfig) -> tuple[ConfigEntry, ...]:
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
        *automation_entries(config.automation),
    )


def config_value_updates(
    request: SetConfigValueRequest,
    config: UserConfig,
) -> tuple[str, tuple[TomlValueUpdate, ...]]:
    key = request.key
    if key == ConfigKey.AUTO_COMMIT:
        normalized = parse_bool_value(request.value, key.value)
        return normalized, (TomlValueUpdate(None, "auto_commit", normalized),)
    if key == ConfigKey.HARNESS_DEFAULT:
        normalized = parse_harness_value(request.value)
        model = DEFAULT_HARNESS_MODELS[HarnessKind(normalized)]
        return normalized, (
            TomlValueUpdate("harness", "default", quoted(normalized)),
            TomlValueUpdate("harness", "model", quoted(model)),
        )
    if key == ConfigKey.HARNESS_MODEL:
        normalized = parse_harness_model(request.value, config.harness.default)
        return normalized, (TomlValueUpdate("harness", "model", quoted(normalized)),)
    if key in automation_enabled_keys():
        normalized = parse_bool_value(request.value, key.value)
        table = automation_table(key)
        return normalized, (TomlValueUpdate(table, "enabled", normalized),)
    if key in automation_interval_keys():
        interval = parse_config_duration(request.value, key.value)
        normalized = duration_text(interval)
        table = automation_table(key)
        return normalized, (TomlValueUpdate(table, "every", quoted(normalized)),)
    raise AssertionError(f"unhandled config key: {key}")


def user_config_updates(
    request: UpdateUserConfigRequest,
) -> tuple[TomlValueUpdate, ...]:
    return (
        TomlValueUpdate(None, "auto_commit", format_bool(request.auto_commit)),
        TomlValueUpdate(
            "harness",
            "default",
            quoted(request.harness.default.value),
        ),
        TomlValueUpdate("harness", "model", quoted(request.harness.model)),
        *automation_toml_updates("automation.sync", request.automation.sync),
        *automation_toml_updates("automation.garden", request.automation.garden),
        *automation_toml_updates("automation.update", request.automation.update),
    )


def automation_toml_updates(
    table: str,
    config: TaskAutomationConfig,
) -> tuple[TomlValueUpdate, ...]:
    return (
        TomlValueUpdate(table, "enabled", format_bool(config.enabled)),
        TomlValueUpdate(table, "every", quoted(duration_text(config.every))),
    )


def automation_task_for_key(key: ConfigKey) -> AutomationTask | None:
    if key.value.startswith("automation.sync."):
        return AutomationTask.SYNC
    if key.value.startswith("automation.garden."):
        return AutomationTask.GARDEN
    if key.value.startswith("automation.update."):
        return AutomationTask.UPDATE
    return None


def automation_table(key: ConfigKey) -> str:
    task = automation_task_for_key(key)
    if task is None:
        raise AssertionError(f"config key is not automation: {key}")
    return f"automation.{task.value}"


def automation_enabled_keys() -> frozenset[ConfigKey]:
    return frozenset(
        (
            ConfigKey.AUTOMATION_SYNC_ENABLED,
            ConfigKey.AUTOMATION_GARDEN_ENABLED,
            ConfigKey.AUTOMATION_UPDATE_ENABLED,
        )
    )


def automation_interval_keys() -> frozenset[ConfigKey]:
    return frozenset(
        (
            ConfigKey.AUTOMATION_SYNC_EVERY,
            ConfigKey.AUTOMATION_GARDEN_EVERY,
            ConfigKey.AUTOMATION_UPDATE_EVERY,
        )
    )


def parse_bool_value(value: str, label: str = "auto_commit") -> str:
    token = value.strip().lower()
    if token not in ("true", "false"):
        raise ValidationFailed(f"{label} must be true or false")
    return token


def parse_harness_value(value: str) -> str:
    token = value.strip().lower()
    kinds = tuple(kind.value for kind in HarnessKind)
    if token not in kinds:
        raise ValidationFailed(f"harness.default must be one of: {', '.join(kinds)}")
    return token


def parse_harness_model(value: str, harness: HarnessKind) -> str:
    token = value.strip()
    if harness == HarnessKind.OPENCODE:
        if not is_opencode_model_shape(token):
            raise ValidationFailed(OPENCODE_MODEL_SHAPE_MESSAGE)
        return token
    if token not in HARNESS_MODELS[harness]:
        allowed = ", ".join(HARNESS_MODELS[harness])
        raise ValidationFailed(
            f"harness.model for {harness.value} must be one of: {allowed}"
        )
    return token


def parse_config_duration(value: str, label: str) -> timedelta:
    try:
        parsed = parse_duration(value.strip(), label)
    except ValueError as error:
        raise ValidationFailed(str(error)) from error
    if not isinstance(parsed, timedelta):
        raise ValidationFailed(f"{label} must be a duration")
    if parsed.total_seconds() <= 0:
        raise ValidationFailed(f"{label} must be greater than zero")
    return parsed


def quoted(value: str) -> str:
    return f'"{value}"'

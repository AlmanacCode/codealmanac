from datetime import timedelta
from enum import StrEnum

from humanfriendly import InvalidTimespan, parse_timespan
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.automation.defaults import (
    DEFAULT_GARDEN_INTERVAL,
    DEFAULT_SYNC_INTERVAL,
    DEFAULT_UPDATE_INTERVAL,
    duration_text,
)
from codealmanac.services.automation.models import (
    AutomationTask,
    AutomationTaskApplyResult,
)
from codealmanac.services.harnesses.models import HarnessKind

DEFAULT_HARNESS = HarnessKind.CODEX
DEFAULT_HARNESS_MODEL = "gpt-5.5"
DEFAULT_AUTO_COMMIT = True
CONTROLLED_HARNESS_MODELS = frozenset(
    (
        "gpt-5.5",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.3-codex-spark",
        "claude-sonnet-5",
        "claude-opus-4-7",
        "claude-haiku-4-5",
    )
)
HARNESS_MODELS = {
    HarnessKind.CODEX: (
        "gpt-5.5",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.3-codex-spark",
    ),
    HarnessKind.CLAUDE: (
        "claude-sonnet-5",
        "claude-opus-4-7",
        "claude-haiku-4-5",
    ),
}
DEFAULT_HARNESS_MODELS = {
    HarnessKind.CODEX: DEFAULT_HARNESS_MODEL,
    HarnessKind.CLAUDE: "claude-sonnet-5",
}


class ConfigKey(StrEnum):
    AUTO_COMMIT = "auto_commit"
    HARNESS_DEFAULT = "harness.default"
    HARNESS_MODEL = "harness.model"
    AUTOMATION_SYNC_ENABLED = "automation.sync.enabled"
    AUTOMATION_SYNC_EVERY = "automation.sync.every"
    AUTOMATION_GARDEN_ENABLED = "automation.garden.enabled"
    AUTOMATION_GARDEN_EVERY = "automation.garden.every"
    AUTOMATION_UPDATE_ENABLED = "automation.update.enabled"
    AUTOMATION_UPDATE_EVERY = "automation.update.every"


class HarnessConfig(CodeAlmanacModel):
    default: HarnessKind = DEFAULT_HARNESS
    model: str = DEFAULT_HARNESS_MODEL

    @field_validator("model")
    @classmethod
    def controlled_model(cls, value: str) -> str:
        if value not in CONTROLLED_HARNESS_MODELS:
            allowed = ", ".join(sorted(CONTROLLED_HARNESS_MODELS))
            raise ValueError(f"harness.model must be one of: {allowed}")
        return value

    @model_validator(mode="after")
    def model_matches_harness(self) -> "HarnessConfig":
        if self.model not in HARNESS_MODELS[self.default]:
            allowed = ", ".join(HARNESS_MODELS[self.default])
            raise ValueError(
                f"harness.model for {self.default.value} must be one of: {allowed}"
            )
        return self


class TaskAutomationConfig(CodeAlmanacModel):
    enabled: bool = True
    every: timedelta

    @field_validator("every", mode="before")
    @classmethod
    def parse_every(cls, value: object) -> object:
        return parse_duration(value, "automation interval")

    @field_validator("every")
    @classmethod
    def positive_every(cls, value: timedelta) -> timedelta:
        if value.total_seconds() <= 0:
            raise ValueError("automation interval must be greater than zero")
        return value


class SyncAutomationConfig(TaskAutomationConfig):
    every: timedelta = DEFAULT_SYNC_INTERVAL


class GardenAutomationConfig(TaskAutomationConfig):
    every: timedelta = DEFAULT_GARDEN_INTERVAL


class UpdateAutomationConfig(TaskAutomationConfig):
    every: timedelta = DEFAULT_UPDATE_INTERVAL


class AutomationConfig(CodeAlmanacModel):
    sync: SyncAutomationConfig = Field(default_factory=SyncAutomationConfig)
    garden: GardenAutomationConfig = Field(default_factory=GardenAutomationConfig)
    update: UpdateAutomationConfig = Field(default_factory=UpdateAutomationConfig)

    def for_task(self, task: AutomationTask) -> TaskAutomationConfig:
        if task == AutomationTask.SYNC:
            return self.sync
        if task == AutomationTask.GARDEN:
            return self.garden
        return self.update


class UserConfig(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, extra="forbid")

    auto_commit: bool = DEFAULT_AUTO_COMMIT
    harness: HarnessConfig = Field(default_factory=HarnessConfig)
    automation: AutomationConfig = Field(default_factory=AutomationConfig)

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        return (init_settings,)


def parse_duration(value: object, label: str) -> object:
    if value is None or isinstance(value, timedelta):
        return value
    if not isinstance(value, str):
        return value
    try:
        return timedelta(seconds=parse_timespan(value))
    except InvalidTimespan as error:
        raise ValueError(f"{label} must be a duration") from error


class ConfigSetResult(CodeAlmanacModel):
    path: str
    key: ConfigKey
    value: str
    automation: AutomationTaskApplyResult | None = None


class ConfigApplyResult(CodeAlmanacModel):
    path: str
    automation: tuple[AutomationTaskApplyResult, ...]


class ConfigUpdateResult(CodeAlmanacModel):
    path: str
    entries: tuple["ConfigEntry", ...]
    automation: tuple[AutomationTaskApplyResult, ...]


class ConfigEntry(CodeAlmanacModel):
    key: ConfigKey
    value: str


def automation_entries(config: AutomationConfig) -> tuple[ConfigEntry, ...]:
    return (
        ConfigEntry(
            key=ConfigKey.AUTOMATION_SYNC_ENABLED,
            value=format_bool(config.sync.enabled),
        ),
        ConfigEntry(
            key=ConfigKey.AUTOMATION_SYNC_EVERY,
            value=duration_text(config.sync.every),
        ),
        ConfigEntry(
            key=ConfigKey.AUTOMATION_GARDEN_ENABLED,
            value=format_bool(config.garden.enabled),
        ),
        ConfigEntry(
            key=ConfigKey.AUTOMATION_GARDEN_EVERY,
            value=duration_text(config.garden.every),
        ),
        ConfigEntry(
            key=ConfigKey.AUTOMATION_UPDATE_ENABLED,
            value=format_bool(config.update.enabled),
        ),
        ConfigEntry(
            key=ConfigKey.AUTOMATION_UPDATE_EVERY,
            value=duration_text(config.update.every),
        ),
    )


def format_bool(value: bool) -> str:
    return "true" if value else "false"

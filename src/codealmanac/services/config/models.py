from datetime import timedelta
from enum import StrEnum

from humanfriendly import InvalidTimespan, parse_timespan
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from codealmanac.core.models import CodeAlmanacModel
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


class UserConfig(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, extra="forbid")

    auto_commit: bool = DEFAULT_AUTO_COMMIT
    harness: HarnessConfig = Field(default_factory=HarnessConfig)

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


class ConfigEntry(CodeAlmanacModel):
    key: ConfigKey
    value: str

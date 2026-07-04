from datetime import timedelta
from typing import Any

from humanfriendly import InvalidTimespan, parse_timespan
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.engine.harnesses.models import HarnessKind

DEFAULT_HARNESS = HarnessKind.CODEX


class HarnessConfig(CodeAlmanacModel):
    default: HarnessKind = DEFAULT_HARNESS


class CodeAlmanacConfig(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, extra="forbid")

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


def parse_duration(value: Any, label: str) -> Any:
    if value is None or isinstance(value, timedelta):
        return value
    if not isinstance(value, str):
        return value
    try:
        return timedelta(seconds=parse_timespan(value))
    except InvalidTimespan as error:
        raise ValueError(f"{label} must be a duration") from error

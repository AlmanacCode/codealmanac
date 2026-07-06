from datetime import timedelta
from pathlib import Path

from humanfriendly import InvalidTimespan, parse_timespan

from codealmanac.app import CodeAlmanac
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.config.models import UserConfig
from codealmanac.services.config.requests import LoadConfigRequest
from codealmanac.services.harnesses.models import HarnessKind


def load_cli_config(app: CodeAlmanac, wiki: str | None) -> UserConfig:
    return app.config.load(LoadConfigRequest(cwd=Path.cwd(), repository_name=wiki))


def load_user_cli_config(app: CodeAlmanac) -> UserConfig:
    return app.config.load_user()


def resolve_harness(value: str | None, config: UserConfig) -> HarnessKind:
    if value is None:
        return config.harness.default
    return HarnessKind(value)


def parse_optional_duration(value: str | None, flag: str) -> timedelta | None:
    if value is None:
        return None
    try:
        seconds = parse_timespan(value)
    except InvalidTimespan as error:
        raise ValidationFailed(f"invalid {flag} value: {value}") from error
    return timedelta(seconds=seconds)

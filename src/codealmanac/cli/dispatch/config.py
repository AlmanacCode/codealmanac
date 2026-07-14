from datetime import timedelta

from humanfriendly import InvalidTimespan, parse_timespan

from codealmanac.app import CodeAlmanac
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.config.models import DEFAULT_HARNESS_MODELS, UserConfig
from codealmanac.services.harnesses.models import HarnessKind


def load_user_cli_config(app: CodeAlmanac) -> UserConfig:
    return app.config.load_user()


def resolve_harness(value: str | None, config: UserConfig) -> HarnessKind:
    if value is None:
        return config.harness.default
    return HarnessKind(value)


def resolve_harness_model(harness: HarnessKind, config: UserConfig) -> str:
    if harness == config.harness.default:
        return config.harness.model
    return DEFAULT_HARNESS_MODELS[harness]


def parse_optional_duration(value: str | None, flag: str) -> timedelta | None:
    if value is None:
        return None
    try:
        seconds = parse_timespan(value)
    except InvalidTimespan as error:
        raise ValidationFailed(f"invalid {flag} value: {value}") from error
    return timedelta(seconds=seconds)

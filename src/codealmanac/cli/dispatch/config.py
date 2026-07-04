from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.engine.harnesses.models import HarnessKind
from codealmanac.services.config.models import CodeAlmanacConfig
from codealmanac.services.config.requests import LoadConfigRequest


def load_cli_config(app: CodeAlmanac, wiki: str | None) -> CodeAlmanacConfig:
    return app.config.load(LoadConfigRequest(cwd=Path.cwd(), wiki=wiki))


def resolve_harness(value: str | None, config: CodeAlmanacConfig) -> HarnessKind:
    if value is None:
        return config.harness.default
    return HarnessKind(value)

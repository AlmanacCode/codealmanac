from pathlib import Path

import pytest

from codealmanac.core.errors import ValidationFailed
from codealmanac.services.config.models import (
    ConfigKey,
    HarnessConfig,
)
from codealmanac.services.config.requests import SetConfigValueRequest
from codealmanac.services.config.service import ConfigService
from codealmanac.services.config.store import ConfigStore
from codealmanac.services.harnesses.models import HarnessKind


class UnusedRepositories:
    def select_for_read(self, cwd: Path, repository_name: str | None):
        raise AssertionError("project config lookup is not used in these tests")


def test_harness_config_rejects_unknown_models() -> None:
    with pytest.raises(ValueError, match="harness.model must be one of"):
        HarnessConfig(default=HarnessKind.CODEX, model="provider-default")


def test_harness_config_rejects_other_provider_models() -> None:
    with pytest.raises(ValueError, match="harness.model for claude must be one of"):
        HarnessConfig(default=HarnessKind.CLAUDE, model="gpt-5.5")


def test_config_set_harness_default_resets_model_to_provider_default(
    tmp_path: Path,
) -> None:
    service = ConfigService(
        repositories=UnusedRepositories(),
        store=ConfigStore(),
        user_config_path=tmp_path / "config.toml",
    )

    service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_DEFAULT, value="claude"))

    entries = {entry.key: entry.value for entry in service.list()}
    assert entries[ConfigKey.HARNESS_DEFAULT] == "claude"
    assert entries[ConfigKey.HARNESS_MODEL] == "claude-sonnet-4-6"


def test_config_set_harness_model_rejects_other_provider_models(tmp_path: Path) -> None:
    service = ConfigService(
        repositories=UnusedRepositories(),
        store=ConfigStore(),
        user_config_path=tmp_path / "config.toml",
    )
    service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_DEFAULT, value="claude"))

    with pytest.raises(
        ValidationFailed,
        match="harness.model for claude must be one of",
    ):
        service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_MODEL, value="gpt-5.5"))


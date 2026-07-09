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


class UnusedAutomation:
    def reconcile_task(self, request):
        raise AssertionError("automation is not used for harness config")


def test_harness_config_rejects_unknown_models() -> None:
    with pytest.raises(ValueError, match="harness.model for codex must be one of"):
        HarnessConfig(default=HarnessKind.CODEX, model="provider-default")


def test_harness_config_accepts_any_provider_slash_model_for_opencode() -> None:
    config = HarnessConfig(default=HarnessKind.OPENCODE, model="anthropic/claude-x")
    assert config.model == "anthropic/claude-x"


def test_harness_config_rejects_opencode_model_without_provider_slash() -> None:
    with pytest.raises(ValueError, match="harness.model for opencode must look like"):
        HarnessConfig(default=HarnessKind.OPENCODE, model="gpt-5.5")


def test_harness_config_rejects_other_provider_models() -> None:
    with pytest.raises(ValueError, match="harness.model for claude must be one of"):
        HarnessConfig(default=HarnessKind.CLAUDE, model="gpt-5.5")


def test_harness_config_rejects_deprecated_claude_models() -> None:
    with pytest.raises(ValueError, match="harness.model for claude must be one of"):
        HarnessConfig(default=HarnessKind.CLAUDE, model="claude-sonnet-4-6")


def test_config_set_harness_default_resets_model_to_provider_default(
    tmp_path: Path,
) -> None:
    service = ConfigService(
        store=ConfigStore(),
        user_config_path=tmp_path / "config.toml",
        automation=UnusedAutomation(),
    )

    service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_DEFAULT, value="claude"))

    entries = {entry.key: entry.value for entry in service.list()}
    assert entries[ConfigKey.HARNESS_DEFAULT] == "claude"
    assert entries[ConfigKey.HARNESS_MODEL] == "claude-sonnet-5"


def test_config_set_harness_model_rejects_other_provider_models(tmp_path: Path) -> None:
    service = ConfigService(
        store=ConfigStore(),
        user_config_path=tmp_path / "config.toml",
        automation=UnusedAutomation(),
    )
    service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_DEFAULT, value="claude"))

    with pytest.raises(
        ValidationFailed,
        match="harness.model for claude must be one of",
    ):
        service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_MODEL, value="gpt-5.5"))


def test_config_set_harness_model_accepts_any_provider_slash_model_for_opencode(
    tmp_path: Path,
) -> None:
    service = ConfigService(
        store=ConfigStore(),
        user_config_path=tmp_path / "config.toml",
        automation=UnusedAutomation(),
    )
    service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_DEFAULT, value="opencode"))

    result = service.set(
        SetConfigValueRequest(
            key=ConfigKey.HARNESS_MODEL, value="anthropic/claude-x"
        )
    )

    assert result.value == "anthropic/claude-x"


def test_config_set_harness_model_rejects_malformed_opencode_model(
    tmp_path: Path,
) -> None:
    service = ConfigService(
        store=ConfigStore(),
        user_config_path=tmp_path / "config.toml",
        automation=UnusedAutomation(),
    )
    service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_DEFAULT, value="opencode"))

    with pytest.raises(
        ValidationFailed,
        match="harness.model for opencode must look like",
    ):
        service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_MODEL, value="gpt-5.5"))

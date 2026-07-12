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


def test_harness_config_rejects_other_provider_models() -> None:
    with pytest.raises(ValueError, match="harness.model for claude must be one of"):
        HarnessConfig(default=HarnessKind.CLAUDE, model="gpt-5.5")


def test_harness_config_rejects_deprecated_claude_models() -> None:
    with pytest.raises(ValueError, match="harness.model for claude must be one of"):
        HarnessConfig(default=HarnessKind.CLAUDE, model="claude-sonnet-4-6")


def test_harness_config_accepts_any_provider_model_shaped_opencode_model() -> None:
    config = HarnessConfig(
        default=HarnessKind.OPENCODE, model="anthropic/claude-sonnet-5"
    )
    assert config.model == "anthropic/claude-sonnet-5"


def test_harness_config_rejects_unshaped_opencode_model() -> None:
    with pytest.raises(ValueError, match='must look like "provider/model"'):
        HarnessConfig(default=HarnessKind.OPENCODE, model="gpt-5.5")


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

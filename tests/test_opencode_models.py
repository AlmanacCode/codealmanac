from pathlib import Path

import pytest

from codealmanac.core.errors import ValidationFailed
from codealmanac.integrations.harnesses.opencode.models import (
    list_opencode_models,
    models_for_selection,
    parse_opencode_models_output,
)
from codealmanac.services.config.models import ConfigKey, HarnessConfig
from codealmanac.services.config.opencode_models import is_opencode_model_id
from codealmanac.services.config.requests import SetConfigValueRequest
from codealmanac.services.config.service import ConfigService, parse_harness_model
from codealmanac.services.config.store import ConfigStore
from codealmanac.services.harnesses.models import HarnessKind


def test_is_opencode_model_id_allows_nested_model_paths() -> None:
    assert is_opencode_model_id("openrouter/z-ai/glm-5")
    assert is_opencode_model_id("opencode/big-pickle")
    assert not is_opencode_model_id("gpt-5.5")
    assert not is_opencode_model_id("opencode/")
    assert not is_opencode_model_id("/model")
    assert not is_opencode_model_id("has space/model")


def test_parse_opencode_models_output_dedupes() -> None:
    models = parse_opencode_models_output(
        "opencode/big-pickle\n"
        "noise\n"
        "openrouter/z-ai/glm-5\n"
        "opencode/big-pickle\n"
    )
    assert models == ("opencode/big-pickle", "openrouter/z-ai/glm-5")


def test_list_opencode_models_uses_cli(runner=None) -> None:
    models = list_opencode_models(
        which=lambda _: "/bin/opencode",
        runner=lambda command, timeout: (
            0,
            "anthropic/claude-sonnet-4-5\nopencode/big-pickle\n",
            "",
        ),
    )
    assert models == ("anthropic/claude-sonnet-4-5", "opencode/big-pickle")


def test_models_for_selection_falls_back_when_missing() -> None:
    models = models_for_selection(which=lambda _: None)
    assert "opencode/big-pickle" in models


def test_harness_config_accepts_any_opencode_model_id() -> None:
    config = HarnessConfig(
        default=HarnessKind.OPENCODE,
        model="openrouter/z-ai/glm-5.2",
    )
    assert config.model == "openrouter/z-ai/glm-5.2"


def test_harness_config_rejects_non_id_for_opencode() -> None:
    with pytest.raises(ValueError, match="provider/model"):
        HarnessConfig(default=HarnessKind.OPENCODE, model="gpt-5.5")


def test_config_set_accepts_live_opencode_model(tmp_path: Path) -> None:
    class UnusedAutomation:
        def reconcile_task(self, request):
            raise AssertionError("unused")

    service = ConfigService(
        store=ConfigStore(),
        user_config_path=tmp_path / "config.toml",
        automation=UnusedAutomation(),
    )
    service.set(SetConfigValueRequest(key=ConfigKey.HARNESS_DEFAULT, value="opencode"))
    service.set(
        SetConfigValueRequest(
            key=ConfigKey.HARNESS_MODEL,
            value="openrouter/z-ai/glm-5",
        )
    )
    entries = {entry.key: entry.value for entry in service.list()}
    assert entries[ConfigKey.HARNESS_MODEL] == "openrouter/z-ai/glm-5"


def test_parse_harness_model_rejects_bad_opencode_id() -> None:
    with pytest.raises(ValidationFailed, match="provider/model"):
        parse_harness_model("not-a-model", HarnessKind.OPENCODE)

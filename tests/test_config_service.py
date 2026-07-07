from pathlib import Path

import pytest
from conftest import initialize_repository

from codealmanac.app import create_app
from codealmanac.core.errors import ValidationFailed
from codealmanac.services.config.models import ConfigKey
from codealmanac.services.config.requests import (
    LoadConfigRequest,
    SetConfigValueRequest,
)
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.settings import AppConfig


def test_config_service_returns_defaults_without_files(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )

    config = app.config.load(LoadConfigRequest(cwd=tmp_path))

    assert config.auto_commit is True
    assert config.harness.default == HarnessKind.CODEX
    assert config.harness.model == "gpt-5.5"


def test_config_service_applies_user_then_project_precedence(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    user_config = isolated_home / ".codealmanac/config.toml"
    user_config.parent.mkdir(parents=True)
    user_config.write_text(
        """
auto_commit = false

[harness]
default = "codex"
model = "gpt-5.5"
""",
        encoding="utf-8",
    )
    repo = tmp_path / "repo"
    repo.mkdir()
    app = create_app(
        AppConfig(
            database_path=isolated_home / ".codealmanac/codealmanac.db",
            config_path=user_config,
        )
    )
    initialize_repository(app, path=repo)
    (repo / "almanac/config.toml").write_text(
        """
auto_commit = true

[harness]
default = "claude"
model = "claude-opus-4-7"
""",
        encoding="utf-8",
    )

    config = app.config.load(LoadConfigRequest(cwd=repo))

    assert config.auto_commit is True
    assert config.harness.default == HarnessKind.CLAUDE
    assert config.harness.model == "claude-opus-4-7"


def test_config_service_uses_selected_repository_project_config(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    first = tmp_path / "first"
    second = tmp_path / "second"
    first.mkdir()
    second.mkdir()
    app = create_app(
        AppConfig(database_path=isolated_home / ".codealmanac/codealmanac.db")
    )
    initialize_repository(app, path=first, name="first")
    initialize_repository(app, path=second, name="second")
    (second / "almanac/config.toml").write_text(
        """
[harness]
default = "claude"
model = "claude-haiku-4-5"
""",
        encoding="utf-8",
    )

    config = app.config.load(
        LoadConfigRequest(cwd=first, repository_name="second")
    )

    assert config.harness.default == HarnessKind.CLAUDE
    assert config.harness.model == "claude-haiku-4-5"


def test_config_service_reports_invalid_toml(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    config_path = isolated_home / ".codealmanac/config.toml"
    config_path.parent.mkdir(parents=True)
    config_path.write_text('[harness\ndefault = "codex"\n', encoding="utf-8")
    app = create_app(
        AppConfig(
            database_path=isolated_home / ".codealmanac/codealmanac.db",
            config_path=config_path,
        )
    )

    with pytest.raises(ValidationFailed, match="invalid config TOML"):
        app.config.load(LoadConfigRequest(cwd=tmp_path))


def test_config_service_reports_invalid_values(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    config_path = isolated_home / ".codealmanac/config.toml"
    config_path.parent.mkdir(parents=True)
    config_path.write_text(
        """
[harness]
default = "cursor"
model = "gpt-5.5"
""",
        encoding="utf-8",
    )
    app = create_app(
        AppConfig(
            database_path=isolated_home / ".codealmanac/codealmanac.db",
            config_path=config_path,
        )
    )

    with pytest.raises(ValidationFailed, match="invalid config"):
        app.config.load(LoadConfigRequest(cwd=tmp_path))


def test_config_service_sets_user_values(
    tmp_path: Path,
    isolated_home: Path,
) -> None:
    config_path = isolated_home / ".codealmanac/config.toml"
    app = create_app(
        AppConfig(
            database_path=isolated_home / ".codealmanac/codealmanac.db",
            config_path=config_path,
        )
    )

    auto_commit = app.config.set(
        SetConfigValueRequest(key=ConfigKey.AUTO_COMMIT, value="false")
    )
    harness = app.config.set(
        SetConfigValueRequest(key=ConfigKey.HARNESS_DEFAULT, value="claude")
    )
    model = app.config.set(
        SetConfigValueRequest(key=ConfigKey.HARNESS_MODEL, value="claude-opus-4-7")
    )
    config = app.config.load(LoadConfigRequest(cwd=tmp_path))

    assert auto_commit.value == "false"
    assert harness.value == "claude"
    assert model.value == "claude-opus-4-7"
    assert config.auto_commit is False
    assert config.harness.default == HarnessKind.CLAUDE
    assert config.harness.model == "claude-opus-4-7"


def test_config_service_rejects_invalid_set_values(
    isolated_home: Path,
) -> None:
    config_path = isolated_home / ".codealmanac/config.toml"
    app = create_app(
        AppConfig(
            database_path=isolated_home / ".codealmanac/codealmanac.db",
            config_path=config_path,
        )
    )

    with pytest.raises(ValidationFailed, match="harness.default must be one of"):
        app.config.set(
            SetConfigValueRequest(key=ConfigKey.HARNESS_DEFAULT, value="gpt")
        )
    with pytest.raises(ValidationFailed, match="harness.model must be one of"):
        app.config.set(
            SetConfigValueRequest(key=ConfigKey.HARNESS_MODEL, value="provider")
        )
    with pytest.raises(ValidationFailed, match="auto_commit must be true or false"):
        app.config.set(
            SetConfigValueRequest(key=ConfigKey.AUTO_COMMIT, value="maybe")
        )
    assert not config_path.exists()

import json
from datetime import timedelta
from pathlib import Path

from codealmanac.cli.render.config import (
    render_config_apply,
    render_config_entry,
    render_config_set,
    render_config_values,
)
from codealmanac.services.automation.models import (
    AutomationTask,
    AutomationTaskApplyResult,
)
from codealmanac.services.config.models import (
    ConfigApplyResult,
    ConfigEntry,
    ConfigKey,
    ConfigSetResult,
)


def apply_result(task: AutomationTask, enabled: bool) -> AutomationTaskApplyResult:
    return AutomationTaskApplyResult(
        task=task,
        enabled=enabled,
        interval=timedelta(hours=1),
        plist_path=Path(f"/tmp/{task.value}.plist"),
        changed=True,
    )


def test_render_config_values_prints_a_key_value_table(capsys):
    render_config_values(
        (
            ConfigEntry(key=ConfigKey.AUTO_COMMIT, value="true"),
            ConfigEntry(key=ConfigKey.HARNESS_DEFAULT, value="claude"),
        ),
        json_output=False,
    )

    lines = capsys.readouterr().out.splitlines()
    assert lines[0].split() == ["KEY", "VALUE"]
    assert lines[1].split() == ["auto_commit", "true"]
    assert lines[2].split() == ["harness.default", "claude"]


def test_render_config_values_json_emits_rows(capsys):
    render_config_values(
        (ConfigEntry(key=ConfigKey.AUTO_COMMIT, value="true"),),
        json_output=True,
    )

    assert json.loads(capsys.readouterr().out) == [
        {"key": "auto_commit", "value": "true"}
    ]


def test_render_config_entry_prints_only_the_value(capsys):
    render_config_entry(
        ConfigEntry(key=ConfigKey.HARNESS_MODEL, value="sonnet"),
        json_output=False,
    )

    assert capsys.readouterr().out == "sonnet\n"


def test_render_config_entry_json_emits_the_entry(capsys):
    render_config_entry(
        ConfigEntry(key=ConfigKey.HARNESS_MODEL, value="sonnet"),
        json_output=True,
    )

    assert json.loads(capsys.readouterr().out)["key"] == "harness.model"


def test_render_config_set_echoes_the_assignment(capsys):
    result = ConfigSetResult(
        path="/tmp/config.toml",
        key=ConfigKey.AUTO_COMMIT,
        value="false",
    )

    render_config_set(result, json_output=False)
    render_config_set(result, json_output=True)

    out = capsys.readouterr().out.splitlines()
    assert out[0] == "config: auto_commit = false"
    assert json.loads("\n".join(out[1:]))["value"] == "false"


def test_render_config_apply_lists_automation_task_states(capsys):
    result = ConfigApplyResult(
        path="/tmp/config.toml",
        automation=(
            apply_result(AutomationTask.SYNC, True),
            apply_result(AutomationTask.GARDEN, False),
        ),
    )

    render_config_apply(result, json_output=False)

    assert capsys.readouterr().out.splitlines() == [
        "config applied",
        "  sync: enabled",
        "  garden: disabled",
    ]


def test_render_config_apply_json_emits_the_result(capsys):
    render_config_apply(
        ConfigApplyResult(path="/tmp/config.toml", automation=()),
        json_output=True,
    )

    assert json.loads(capsys.readouterr().out)["path"] == "/tmp/config.toml"

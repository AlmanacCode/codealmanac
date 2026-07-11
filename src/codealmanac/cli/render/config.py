from codealmanac.cli.render.common import print_json_model, print_json_rows
from codealmanac.cli.render.style import table
from codealmanac.services.config.models import (
    ConfigApplyResult,
    ConfigEntry,
    ConfigSetResult,
)


def render_config_values(
    entries: tuple[ConfigEntry, ...],
    json_output: bool,
) -> None:
    if json_output:
        print_json_rows(entries)
        return
    for line in table(
        ("KEY", "VALUE"),
        [(entry.key.value, entry.value) for entry in entries],
    ):
        print(line)


def render_config_entry(entry: ConfigEntry, json_output: bool) -> None:
    if json_output:
        print_json_model(entry)
        return
    print(entry.value)


def render_config_set(result: ConfigSetResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    print(f"config: {result.key.value} = {result.value}")


def render_config_apply(result: ConfigApplyResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    print("config applied")
    for task in result.automation:
        state = "enabled" if task.enabled else "disabled"
        print(f"  {task.task.value}: {state}")

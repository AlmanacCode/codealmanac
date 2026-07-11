import tomllib
from dataclasses import dataclass
from pathlib import Path
from tomllib import TOMLDecodeError

from pydantic import ValidationError
from pydantic_settings import TomlConfigSettingsSource

from codealmanac.core.errors import ValidationFailed
from codealmanac.services.config.models import UserConfig


class ConfigStore:
    def load(self, path: Path) -> UserConfig:
        try:
            source = TomlConfigSettingsSource(
                UserConfig,
                toml_file=path,
                deep_merge=True,
            )
            return UserConfig(_build_sources=((source,), {}))
        except TOMLDecodeError as error:
            raise ValidationFailed(f"invalid config TOML: {error}") from error
        except ValidationError as error:
            raise ValidationFailed(f"invalid config: {error}") from error

    def set_value(
        self,
        path: Path,
        table: str | None,
        key: str,
        literal: str,
    ) -> None:
        self.set_values(path, (TomlValueUpdate(table, key, literal),))

    def set_values(
        self,
        path: Path,
        updates: tuple["TomlValueUpdate", ...],
    ) -> None:
        body = ""
        if path.exists():
            try:
                body = path.read_text(encoding="utf-8")
                tomllib.loads(body)
            except TOMLDecodeError as error:
                raise ValidationFailed(f"invalid config TOML: {error}") from error
            except OSError as error:
                raise ValidationFailed(f"cannot read config: {error}") from error
        updated = body
        for update in updates:
            updated = update_toml_value(
                body=updated,
                table=update.table,
                key=update.key,
                literal=update.literal,
            )
        validate_config_body(updated)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(updated, encoding="utf-8")
        except OSError as error:
            raise ValidationFailed(f"cannot write config: {error}") from error


@dataclass(frozen=True)
class TomlValueUpdate:
    table: str | None
    key: str
    literal: str


def validate_config_body(body: str) -> None:
    try:
        UserConfig.model_validate(tomllib.loads(body))
    except TOMLDecodeError as error:
        raise ValidationFailed(f"invalid config TOML: {error}") from error
    except ValidationError as error:
        raise ValidationFailed(f"invalid config: {error}") from error


def update_toml_value(body: str, table: str | None, key: str, literal: str) -> str:
    replacement = f"{key} = {literal}"
    lines = strip_leading_blank_lines(body.splitlines())
    if table is None:
        return update_top_level_value(lines, key, replacement)
    return update_table_value(lines, table, key, replacement)


def update_top_level_value(lines: list[str], key: str, replacement: str) -> str:
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("["):
            return insert_before_table(lines, index, replacement)
        if top_level_key(stripped) == key:
            lines[index] = replacement
            return with_trailing_newline(lines)
    return with_trailing_newline([replacement, *lines])


def update_table_value(
    lines: list[str],
    table: str,
    key: str,
    replacement: str,
) -> str:
    header = f"[{table}]"
    in_table = False
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("["):
            if in_table:
                return insert_into_table(lines, index, replacement)
            in_table = stripped == header
            continue
        if in_table and top_level_key(stripped) == key:
            lines[index] = replacement
            return with_trailing_newline(lines)
    if in_table:
        return with_trailing_newline([*lines, replacement])
    if lines and lines[-1].strip():
        return with_trailing_newline([*lines, "", header, replacement])
    return with_trailing_newline([*lines, header, replacement])


def insert_into_table(lines: list[str], index: int, replacement: str) -> str:
    prefix = lines[:index]
    while prefix and not prefix[-1].strip():
        prefix = prefix[:-1]
    return with_trailing_newline([*prefix, replacement, "", *lines[index:]])


def strip_leading_blank_lines(lines: list[str]) -> list[str]:
    while lines and not lines[0].strip():
        lines = lines[1:]
    return lines


def insert_before_table(lines: list[str], index: int, replacement: str) -> str:
    prefix = lines[:index]
    suffix = lines[index:]
    if prefix and prefix[-1].strip():
        prefix = [*prefix, ""]
    return with_trailing_newline([*prefix, replacement, "", *suffix])


def top_level_key(stripped_line: str) -> str | None:
    if not stripped_line or stripped_line.startswith("#") or "=" not in stripped_line:
        return None
    return stripped_line.split("=", 1)[0].strip()


def bool_literal(value: bool) -> str:
    return "true" if value else "false"


def with_trailing_newline(lines: list[str]) -> str:
    return "\n".join(lines).rstrip() + "\n"

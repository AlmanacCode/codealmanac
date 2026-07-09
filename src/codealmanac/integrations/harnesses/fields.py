import json
from collections.abc import Mapping
from typing import TypeGuard, cast

from pydantic import JsonValue

JsonObject = dict[str, JsonValue]


def as_record(value: JsonValue | None) -> JsonObject:
    if is_json_object(value):
        return value
    return {}


def is_json_object(value: JsonValue | None) -> TypeGuard[JsonObject]:
    return isinstance(value, dict)


def string_field(record: Mapping[str, JsonValue], field: str) -> str | None:
    value = record.get(field)
    if isinstance(value, str) and value != "":
        return value
    return None


def number_field(record: Mapping[str, JsonValue], field: str) -> int | None:
    value = record.get(field)
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def boolean_field(record: Mapping[str, JsonValue], field: str) -> bool | None:
    value = record.get(field)
    if isinstance(value, bool):
        return value
    return None


def string_array_field(record: Mapping[str, JsonValue], field: str) -> tuple[str, ...]:
    value = record.get(field)
    if not isinstance(value, list):
        return ()
    return tuple(item for item in value if isinstance(item, str) and item != "")


def compact_json(value: JsonValue) -> str:
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def stringify_json_value(value: JsonValue | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return compact_json(value)


def prune_none(value: dict[str, JsonValue | None]) -> JsonObject:
    return cast(
        JsonObject,
        {key: item for key, item in value.items() if item is not None},
    )


def first_present[T](*values: T | None) -> T | None:
    for value in values:
        if value is not None:
            return value
    return None

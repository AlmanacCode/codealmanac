from collections.abc import Mapping
from dataclasses import asdict, is_dataclass

from pydantic import JsonValue


def raw_message(message: object) -> JsonValue:
    return json_value(message)


def raw_block(block: object) -> JsonValue:
    return json_value(block)


# Raw provider payloads are intentionally opaque external passthrough. Convert
# them to JSON-compatible values before attaching them to HarnessEvent.raw.
def json_value(value: object) -> JsonValue:
    if value is None:
        return None
    if isinstance(value, str | int | float | bool):
        return value
    if is_dataclass(value) and not isinstance(value, type):
        return json_value(asdict(value))
    if isinstance(value, Mapping):
        return {str(key): json_value(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [json_value(item) for item in value]
    return str(value)

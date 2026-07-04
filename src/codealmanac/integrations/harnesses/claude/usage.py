from collections.abc import Mapping

from codealmanac.engine.harnesses.models import HarnessUsage


def parse_claude_usage(value: Mapping[str, object] | None) -> HarnessUsage | None:
    if value is None:
        return None
    input_tokens = int_field(value, "input_tokens")
    cached_input_tokens = int_field(value, "cache_read_input_tokens")
    output_tokens = int_field(value, "output_tokens")
    if input_tokens is None and cached_input_tokens is None and output_tokens is None:
        return None
    total_tokens = None
    if input_tokens is not None or output_tokens is not None:
        total_tokens = (input_tokens or 0) + (output_tokens or 0)
    return HarnessUsage(
        input_tokens=input_tokens,
        cached_input_tokens=cached_input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
    )


def int_field(record: Mapping[str, object], field: str) -> int | None:
    value = record.get(field)
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    return None

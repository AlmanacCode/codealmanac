from pydantic import JsonValue

from codealmanac.integrations.harnesses.fields import (
    as_record,
    first_present,
    number_field,
)
from codealmanac.services.harnesses.models import HarnessUsage


def parse_codex_app_server_usage(value: JsonValue | None) -> HarnessUsage | None:
    usage = as_record(value)
    last = as_record(usage.get("last"))
    total = as_record(usage.get("total"))
    direct = parse_codex_usage(last)
    if direct is None:
        return None
    return direct.model_copy(
        update={
            "total_tokens": first_present(
                number_field(last, "totalTokens"),
                number_field(last, "total_tokens"),
                direct.total_tokens,
            ),
            "total_processed_tokens": first_present(
                number_field(total, "totalTokens"),
                number_field(total, "total_tokens"),
            ),
            "max_tokens": first_present(
                number_field(usage, "modelContextWindow"),
                number_field(usage, "model_context_window"),
            ),
        }
    )


def parse_codex_usage(value: JsonValue | None) -> HarnessUsage | None:
    obj = as_record(value)
    if len(obj) == 0:
        return None
    input_tokens = first_present(
        number_field(obj, "input_tokens"),
        number_field(obj, "inputTokens"),
    )
    cached_input_tokens = first_present(
        number_field(obj, "cached_input_tokens"),
        number_field(obj, "cachedInputTokens"),
        number_field(obj, "cacheReadTokens"),
    )
    output_tokens = first_present(
        number_field(obj, "output_tokens"),
        number_field(obj, "outputTokens"),
    )
    reasoning_output_tokens = first_present(
        number_field(obj, "reasoning_output_tokens"),
        number_field(obj, "reasoningOutputTokens"),
    )
    total_tokens = None
    if input_tokens is not None or output_tokens is not None:
        total_tokens = (input_tokens or 0) + (output_tokens or 0)
    return HarnessUsage(
        input_tokens=input_tokens,
        cached_input_tokens=cached_input_tokens,
        output_tokens=output_tokens,
        reasoning_output_tokens=reasoning_output_tokens,
        total_tokens=total_tokens,
    )

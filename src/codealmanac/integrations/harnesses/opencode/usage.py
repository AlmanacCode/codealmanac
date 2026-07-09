from pydantic import JsonValue

from codealmanac.integrations.harnesses.fields import as_record, number_field
from codealmanac.services.harnesses.models import HarnessUsage


def parse_opencode_usage(value: JsonValue | None) -> HarnessUsage | None:
    obj = as_record(value)
    if len(obj) == 0:
        return None
    cache = as_record(obj.get("cache"))
    return HarnessUsage(
        input_tokens=number_field(obj, "input"),
        cached_input_tokens=number_field(cache, "read"),
        output_tokens=number_field(obj, "output"),
        reasoning_output_tokens=number_field(obj, "reasoning"),
        total_tokens=number_field(obj, "total"),
    )

import json
import re

from pydantic import JsonValue

from codealmanac.integrations.harnesses.fields import (
    JsonObject,
    as_record,
    number_field,
)
from codealmanac.services.harnesses.models import HarnessFailure, HarnessKind


def classify_codex_failure(
    message: str,
    status_code: int | None = None,
    data: JsonValue | None = None,
) -> HarnessFailure:
    detail = structured_detail(data) or extract_json_detail(message)
    text = detail or message
    code = status_code or extract_status_code(message)
    model = match_first(
        text,
        (
            r"The '([^']+)' model requires a newer version of Codex",
            r"The '([^']+)' model is not supported",
        ),
    )

    if "requires a newer version of Codex" in text and model is not None:
        return HarnessFailure(
            provider=HarnessKind.CODEX,
            code="codex.model_requires_newer_cli",
            message=f"Codex model {model} requires a newer Codex CLI.",
            fix="Upgrade Codex, or choose a supported Codex model.",
            raw=message,
            details=failure_details(model=model, status_code=code, data=data),
        )
    if "model is not supported" in text and model is not None:
        return HarnessFailure(
            provider=HarnessKind.CODEX,
            code="codex.model_unavailable",
            message=f"Codex model {model} is not available for this account.",
            fix="Choose a supported Codex model or update the configured Codex model.",
            raw=message,
            details=failure_details(model=model, status_code=code, data=data),
        )
    if "401 Unauthorized" in text or "Unauthorized" in text:
        return HarnessFailure(
            provider=HarnessKind.CODEX,
            code="codex.not_authenticated",
            message="Codex is not authenticated in this environment.",
            fix=(
                "Run `codex login` in the same environment, or make the existing "
                "Codex auth available to this process."
            ),
            raw=message,
            details=failure_details(status_code=code or 401, data=data),
        )
    if "not found on PATH" in text:
        return HarnessFailure(
            provider=HarnessKind.CODEX,
            code="codex.not_installed",
            message="Codex was not found on PATH.",
            fix="Install Codex or update PATH so the `codex` command is available.",
            raw=message,
        )
    return HarnessFailure(
        provider=HarnessKind.CODEX,
        code="codex.process_failed",
        message=text,
        raw=message,
        details=failure_details(status_code=code, data=data),
    )


def failure_details(
    model: str | None = None,
    status_code: int | None = None,
    data: JsonValue | None = None,
) -> dict[str, JsonValue] | None:
    details: JsonObject = {}
    if model is not None:
        details["model"] = model
    if status_code is not None:
        details["status_code"] = status_code
    if data is not None:
        details["data"] = data
    return details or None


def structured_detail(data: JsonValue | None) -> str | None:
    record = as_record(data)
    detail = record.get("detail") or record.get("message")
    if isinstance(detail, str) and detail != "":
        return detail
    return None


def extract_json_detail(raw: str) -> str | None:
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return None
    return structured_detail(parsed)


def extract_status_code(raw: str) -> int | None:
    match = re.search(r"status\s+(\d{3})|(\d{3})\s+(?:Bad Request|Unauthorized)", raw)
    if match is None:
        return None
    value = match.group(1) or match.group(2)
    return int(value)


def match_first(text: str, patterns: tuple[str, ...]) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text)
        if match is not None:
            return match.group(1)
    return None


def failure_from_error_record(error: JsonObject) -> HarnessFailure:
    value = error.get("message") or error.get("detail")
    message = value if isinstance(value, str) else "Codex error"
    return classify_codex_failure(
        message,
        number_field(error, "statusCode") or number_field(error, "code"),
        error,
    )

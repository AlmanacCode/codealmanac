from codealmanac.services.harnesses.models import HarnessFailure, HarnessKind


def classify_claude_failure(
    raw: str,
    subtype: str | None = None,
) -> HarnessFailure:
    lowered = raw.lower()
    if "not logged in" in lowered or "authentication" in lowered:
        return HarnessFailure(
            provider=HarnessKind.CLAUDE,
            code="claude.not_authenticated",
            message="Claude is not authenticated in this environment.",
            fix=(
                "Run `claude` and log in, or configure ANTHROPIC_API_KEY "
                "for this process."
            ),
            raw=raw,
            details=details_for_subtype(subtype),
        )
    if subtype == "error_max_budget_usd":
        return HarnessFailure(
            provider=HarnessKind.CLAUDE,
            code="claude.max_budget_exceeded",
            message="Claude stopped because the run exceeded its maximum budget.",
            fix="Raise the budget for this run or use a cheaper model.",
            raw=raw,
            details=details_for_subtype(subtype),
        )
    return HarnessFailure(
        provider=HarnessKind.CLAUDE,
        code=f"claude.{subtype}" if subtype is not None else "claude.process_failed",
        message=raw,
        raw=raw,
        details=details_for_subtype(subtype),
    )


def details_for_subtype(subtype: str | None) -> dict[str, str] | None:
    if subtype is None:
        return None
    return {"subtype": subtype}

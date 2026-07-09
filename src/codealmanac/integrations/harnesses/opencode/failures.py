from codealmanac.services.harnesses.models import HarnessFailure, HarnessKind


def classify_opencode_failure(message: str, code: str | None = None) -> HarnessFailure:
    if "not found on PATH" in message:
        return HarnessFailure(
            provider=HarnessKind.OPENCODE,
            code="opencode.not_installed",
            message="OpenCode was not found on PATH.",
            fix=(
                "Install OpenCode or update PATH so the `opencode` command "
                "is available."
            ),
            raw=message,
        )
    if (
        "did not report a listening port" in message
        or "exited before it started listening" in message
    ):
        return HarnessFailure(
            provider=HarnessKind.OPENCODE,
            code="opencode.server_start_failed",
            message=message,
            fix="Run `opencode serve` directly to check for a startup error.",
            raw=message,
        )
    if "tool call has been stuck" in message:
        return HarnessFailure(
            provider=HarnessKind.OPENCODE,
            code="opencode.stuck_tool_call",
            message=message,
            fix=(
                "This is an upstream OpenCode reliability issue, not "
                "specific to this run. Retrying often succeeds; if it "
                "keeps happening, a different model may avoid the tool "
                "call shape that triggers it."
            ),
            raw=message,
        )
    if "timed out" in message:
        return HarnessFailure(
            provider=HarnessKind.OPENCODE,
            code="opencode.timeout",
            message=message,
            raw=message,
        )
    return HarnessFailure(
        provider=HarnessKind.OPENCODE,
        code=code or "opencode.request_failed",
        message=message,
        raw=message,
    )

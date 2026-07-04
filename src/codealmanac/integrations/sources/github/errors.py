from codealmanac.engine.sources.models import (
    SourceRef,
    SourceRuntime,
    SourceRuntimeStatus,
)


def unavailable_runtime(
    ref: SourceRef,
    title: str,
    error: Exception,
) -> SourceRuntime:
    return SourceRuntime(
        ref=ref,
        status=SourceRuntimeStatus.UNAVAILABLE,
        title=title,
        diagnostics=(first_error_line(error),),
    )


def first_error_line(error: Exception) -> str:
    lines = [line.strip() for line in str(error).splitlines() if line.strip()]
    if not lines:
        return error.__class__.__name__
    return lines[0]

from typing import Literal

ErrorCode = Literal[
    "codealmanac_error",
    "already_exists",
    "not_found",
    "repository_not_selected",
    "conflict",
    "validation_failed",
    "execution_failed",
]


class CodeAlmanacError(Exception):
    """Base class for product errors that cross CLI and future server edges."""

    code: ErrorCode = "codealmanac_error"


class NotFoundError(CodeAlmanacError):
    code: ErrorCode = "not_found"

    def __init__(self, resource: str, identifier: str):
        super().__init__(f"{resource} not found: {identifier}")
        self.resource = resource
        self.identifier = identifier


class NoRepositorySelected(CodeAlmanacError):
    code: ErrorCode = "repository_not_selected"

    def __init__(self):
        super().__init__(
            "No repository selected. Run from a registered repository root "
            "or pass --wiki <name>."
        )


class AlreadyExists(CodeAlmanacError):
    code: ErrorCode = "already_exists"

    def __init__(self, resource: str, identifier: str, message: str | None = None):
        super().__init__(message or f"{resource} already exists: {identifier}")
        self.resource = resource
        self.identifier = identifier


class ConflictError(CodeAlmanacError):
    code: ErrorCode = "conflict"

    def __init__(self, message: str):
        super().__init__(message)


class ValidationFailed(CodeAlmanacError):
    code: ErrorCode = "validation_failed"

    def __init__(self, message: str):
        super().__init__(message)


class ExecutionFailed(CodeAlmanacError):
    code: ErrorCode = "execution_failed"

    def __init__(self, message: str):
        super().__init__(message)


def error_summary(error: Exception) -> str:
    try:
        text = str(error).strip()
    except Exception:
        return error.__class__.__name__
    if text == "":
        return error.__class__.__name__
    return text.splitlines()[0]

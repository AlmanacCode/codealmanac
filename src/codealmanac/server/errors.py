from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from codealmanac.core.errors import CodeAlmanacError, ConflictError, NotFoundError


def register_error_handlers(server: FastAPI) -> None:
    server.add_exception_handler(CodeAlmanacError, product_error_response)
    server.add_exception_handler(ValidationError, validation_error_response)


async def product_error_response(
    _request: Request,
    error: CodeAlmanacError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code_for(error),
        content={"detail": {"code": error.code, "message": str(error)}},
    )


async def validation_error_response(
    _request: Request,
    error: ValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "validation_failed", "message": str(error)}},
    )


def status_code_for(error: CodeAlmanacError) -> int:
    if isinstance(error, NotFoundError):
        return 404
    if isinstance(error, ConflictError):
        return 409
    return 400

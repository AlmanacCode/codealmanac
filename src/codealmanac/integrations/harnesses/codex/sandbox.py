import os
from pathlib import Path
from typing import Literal

from codealmanac.integrations.harnesses.codex.errors import CodexAppServerError
from codealmanac.integrations.harnesses.codex.fields import JsonObject

CODEX_APP_SERVER_SANDBOX_MODE_ENV = "CODEALMANAC_CODEX_APP_SERVER_SANDBOX_MODE"

SandboxMode = Literal["repository-write", "danger-full-access"]


def sandbox_policy(cwd: Path, mode: SandboxMode) -> JsonObject:
    if mode == "danger-full-access":
        return {"type": "dangerFullAccess"}
    return {
        "type": "repositoryWrite",
        "writableRoots": [str(cwd)],
        "networkAccess": False,
        "excludeTmpdirEnvVar": False,
        "excludeSlashTmp": False,
    }


def resolve_sandbox_mode(value: SandboxMode | None) -> SandboxMode:
    if value is not None:
        return value
    env_value = os.environ.get(CODEX_APP_SERVER_SANDBOX_MODE_ENV)
    if env_value in {None, "", "repository-write"}:
        return "repository-write"
    if env_value == "danger-full-access":
        return "danger-full-access"
    raise CodexAppServerError(
        f"{CODEX_APP_SERVER_SANDBOX_MODE_ENV} must be "
        "repository-write or danger-full-access"
    )

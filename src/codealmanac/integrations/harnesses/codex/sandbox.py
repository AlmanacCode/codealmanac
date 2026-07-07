import os
from pathlib import Path
from typing import Literal

from codealmanac.integrations.harnesses.codex.errors import CodexAppServerError
from codealmanac.integrations.harnesses.codex.fields import JsonObject

CODEX_APP_SERVER_SANDBOX_MODE_ENV = "CODEALMANAC_CODEX_APP_SERVER_SANDBOX_MODE"

SandboxMode = Literal["workspace-write", "danger-full-access"]


def sandbox_policy(cwd: Path, mode: SandboxMode) -> JsonObject:
    if mode == "danger-full-access":
        return {"type": "dangerFullAccess"}
    return {
        "type": "workspaceWrite",
        "writableRoots": [str(cwd)],
        "networkAccess": False,
        "excludeTmpdirEnvVar": False,
        "excludeSlashTmp": False,
    }


def resolve_sandbox_mode(value: SandboxMode | None) -> SandboxMode:
    if value is not None:
        return value
    env_value = os.environ.get(CODEX_APP_SERVER_SANDBOX_MODE_ENV)
    if env_value in {None, "", "danger-full-access"}:
        return "danger-full-access"
    if env_value == "workspace-write":
        return "workspace-write"
    raise CodexAppServerError(
        f"{CODEX_APP_SERVER_SANDBOX_MODE_ENV} must be "
        "workspace-write or danger-full-access"
    )

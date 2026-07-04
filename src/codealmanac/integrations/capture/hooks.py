import json
from pathlib import Path
from typing import Any

from codealmanac.cloud.capture.models import (
    CaptureHookChange,
    CaptureHookStatus,
    CaptureProvider,
)
from codealmanac.core.errors import ValidationFailed
from codealmanac.core.paths import home_dir

CAPTURE_STATUS_MESSAGE = "CodeAlmanac capture"
CODEX_COMMAND = "codealmanac-capture-hook --provider codex"
CLAUDE_COMMAND = "codealmanac-capture-hook --provider claude"
STOP_EVENT = "Stop"


class FileCaptureHookManager:
    def __init__(self, home: Path | None = None):
        self._home = home

    def install(self, provider: CaptureProvider) -> CaptureHookChange:
        path = provider_path(self.home, provider)
        config = read_config(path)
        command = provider_command(provider)
        next_config, changed = upsert_stop_hook(config, command)
        if changed:
            path.parent.mkdir(parents=True, exist_ok=True)
            write_config(path, next_config)
        return CaptureHookChange(
            provider=provider,
            installed=True,
            changed=changed,
            path=str(path),
            message=(
                f"installed {provider} capture hook"
                if changed
                else f"{provider} capture hook already installed"
            ),
        )

    def uninstall(self, provider: CaptureProvider) -> CaptureHookChange:
        path = provider_path(self.home, provider)
        config = read_config(path)
        command = provider_command(provider)
        next_config, changed = remove_stop_hook(config, command)
        if changed:
            write_config(path, next_config)
        installed = has_stop_hook(next_config, command)
        return CaptureHookChange(
            provider=provider,
            installed=installed,
            changed=changed,
            path=str(path),
            message=(
                f"removed {provider} capture hook"
                if changed
                else f"{provider} capture hook was not installed"
            ),
        )

    def status(self, provider: CaptureProvider) -> CaptureHookStatus:
        path = provider_path(self.home, provider)
        command = provider_command(provider)
        installed = has_stop_hook(read_config(path), command)
        message = (
            f"{provider} capture hook installed"
            if installed
            else f"{provider} capture hook missing"
        )
        if provider == "codex" and installed:
            message += "; Codex may require /hooks trust"
        return CaptureHookStatus(
            provider=provider,
            installed=installed,
            path=str(path),
            message=message,
        )

    @property
    def home(self) -> Path:
        return self._home or home_dir()


def provider_path(home: Path, provider: CaptureProvider) -> Path:
    if provider == "claude":
        return home / ".claude" / "settings.json"
    if provider == "codex":
        return home / ".codex" / "hooks.json"
    raise ValueError(f"unsupported capture provider: {provider}")


def provider_command(provider: CaptureProvider) -> str:
    if provider == "claude":
        return CLAUDE_COMMAND
    if provider == "codex":
        return CODEX_COMMAND
    raise ValueError(f"unsupported capture provider: {provider}")


def read_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValidationFailed(f"invalid hook JSON at {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValidationFailed(f"invalid hook JSON at {path}: expected object")
    return value


def write_config(path: Path, config: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(config, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def upsert_stop_hook(
    config: dict[str, Any],
    command: str,
) -> tuple[dict[str, Any], bool]:
    if has_stop_hook(config, command):
        return config, False
    next_config = dict(config)
    hooks = ensure_hooks(next_config)
    stop_groups = ensure_stop_groups(hooks)
    stop_groups.append(
        {
            "matcher": "",
            "hooks": [
                {
                    "type": "command",
                    "command": command,
                    "timeout": 30,
                    "statusMessage": CAPTURE_STATUS_MESSAGE,
                }
            ],
        }
    )
    return next_config, True


def remove_stop_hook(
    config: dict[str, Any],
    command: str,
) -> tuple[dict[str, Any], bool]:
    next_config = dict(config)
    hooks = next_config.get("hooks")
    if not isinstance(hooks, dict):
        return config, False
    groups = hooks.get(STOP_EVENT)
    if not isinstance(groups, list):
        return config, False
    changed = False
    kept_groups: list[Any] = []
    for group in groups:
        if not isinstance(group, dict):
            kept_groups.append(group)
            continue
        entries = group.get("hooks")
        if not isinstance(entries, list):
            kept_groups.append(group)
            continue
        kept_entries = [
            entry for entry in entries if not is_command_hook(entry, command)
        ]
        if len(kept_entries) != len(entries):
            changed = True
        if len(kept_entries) > 0:
            next_group = dict(group)
            next_group["hooks"] = kept_entries
            kept_groups.append(next_group)
    if not changed:
        return config, False
    if kept_groups:
        hooks[STOP_EVENT] = kept_groups
    else:
        hooks.pop(STOP_EVENT, None)
    if len(hooks) == 0:
        next_config.pop("hooks", None)
    return next_config, True


def has_stop_hook(config: dict[str, Any], command: str) -> bool:
    hooks = config.get("hooks")
    if not isinstance(hooks, dict):
        return False
    groups = hooks.get(STOP_EVENT)
    if not isinstance(groups, list):
        return False
    for group in groups:
        if not isinstance(group, dict):
            continue
        entries = group.get("hooks")
        if not isinstance(entries, list):
            continue
        if any(is_command_hook(entry, command) for entry in entries):
            return True
    return False


def ensure_hooks(config: dict[str, Any]) -> dict[str, Any]:
    hooks = config.get("hooks")
    if hooks is None:
        config["hooks"] = {}
        return config["hooks"]
    if not isinstance(hooks, dict):
        raise ValidationFailed("invalid hook JSON: hooks must be an object")
    return hooks


def ensure_stop_groups(hooks: dict[str, Any]) -> list[Any]:
    groups = hooks.get(STOP_EVENT)
    if groups is None:
        hooks[STOP_EVENT] = []
        return hooks[STOP_EVENT]
    if not isinstance(groups, list):
        raise ValidationFailed("invalid hook JSON: Stop hooks must be a list")
    return groups


def is_command_hook(value: Any, command: str) -> bool:
    return isinstance(value, dict) and value.get("command") == command

import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.admin import (
    render_config_apply,
    render_config_entry,
    render_config_set,
    render_config_values,
)
from codealmanac.services.config.models import ConfigKey
from codealmanac.services.config.requests import (
    ApplyConfigRequest,
    GetConfigValueRequest,
    SetConfigValueRequest,
)


def dispatch_config(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.config_command == "list":
        render_config_values(app.config.list(), json_output=args.json)
        return 0
    if args.config_command == "get":
        entry = app.config.get(GetConfigValueRequest(key=ConfigKey(args.key)))
        render_config_entry(entry, json_output=args.json)
        return 0
    if args.config_command == "set":
        result = app.config.set(
            SetConfigValueRequest(key=ConfigKey(args.key), value=args.value)
        )
        render_config_set(result, json_output=args.json)
        return 0
    if args.config_command == "apply":
        result = app.config.apply(ApplyConfigRequest())
        render_config_apply(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled config command: {args.config_command}")

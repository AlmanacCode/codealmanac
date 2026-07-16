import argparse
import sys
import time
from contextlib import suppress
from pathlib import Path

from pydantic import ValidationError

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.root import dispatch as dispatch_app
from codealmanac.cli.telemetry import capture_command
from codealmanac.core.errors import CodeAlmanacError


def execute(
    args: argparse.Namespace,
    app: CodeAlmanac,
    started_at: float,
) -> int:
    if args.command == "uninstall":
        app.telemetry.prepare_for_state_removal()
    try:
        exit_code = dispatch_app(args, app)
    except (CodeAlmanacError, ValidationError) as error:
        print(f"codealmanac: {error}", file=sys.stderr)
        capture_command(
            app.telemetry,
            args,
            outcome="failed",
            exit_code=1,
            duration_seconds=time.monotonic() - started_at,
        )
        return 1
    except KeyboardInterrupt:
        capture_command(
            app.telemetry,
            args,
            outcome="interrupted",
            exit_code=130,
            duration_seconds=time.monotonic() - started_at,
        )
        raise
    except Exception as error:
        command = getattr(args, "command", "unknown")
        app.telemetry.capture_exception(
            error,
            command=command,
            process_kind=process_kind(command),
            sensitive_paths=telemetry_sensitive_paths(app),
            sensitive_values=sensitive_argument_values(args),
        )
        capture_command(
            app.telemetry,
            args,
            outcome="crashed",
            exit_code=1,
            duration_seconds=time.monotonic() - started_at,
        )
        raise
    capture_command(
        app.telemetry,
        args,
        outcome="success" if exit_code == 0 else "failed",
        exit_code=exit_code,
        duration_seconds=time.monotonic() - started_at,
    )
    return exit_code


def process_kind(command: str) -> str:
    return {
        "__run-worker": "worker",
        "__run-executor": "executor",
        "__garden-scheduler": "scheduler",
    }.get(command, "foreground")


def telemetry_sensitive_paths(app: CodeAlmanac) -> tuple[Path, ...]:
    paths = [app.local_state.state_dir]
    with suppress(OSError):
        paths.append(Path.cwd())
    return tuple(paths)


def sensitive_argument_values(args: argparse.Namespace) -> tuple[str, ...]:
    controlled_fields = {
        "command",
        "sync_command",
        "topic_command",
        "config_command",
        "jobs_command",
        "automation_command",
    }
    values: list[str] = []
    for field, value in vars(args).items():
        if field not in controlled_fields:
            append_sensitive_values(values, value)
    return tuple(values)


def append_sensitive_values(values: list[str], value: object) -> None:
    if isinstance(value, str):
        values.append(value)
        return
    if isinstance(value, Path):
        values.append(str(value))
        return
    if isinstance(value, (list, tuple, set)):
        for item in value:
            append_sensitive_values(values, item)

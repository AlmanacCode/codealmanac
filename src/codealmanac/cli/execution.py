import argparse
import sys
import time

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
        outcome=outcome_for_exit_code(exit_code),
        exit_code=exit_code,
        duration_seconds=time.monotonic() - started_at,
    )
    return exit_code


def outcome_for_exit_code(exit_code: int) -> str:
    if exit_code == 0:
        return "success"
    if exit_code == 130:
        return "interrupted"
    return "failed"


def process_kind(command: str) -> str:
    return {
        "__run-worker": "worker",
        "__run-executor": "executor",
        "__garden-scheduler": "scheduler",
    }.get(command, "foreground")

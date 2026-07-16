import argparse
import sys

from codealmanac.services.telemetry.durations import duration_bucket
from codealmanac.services.telemetry.models import CliCommandCompletedProperties
from codealmanac.services.telemetry.service import TelemetryService

PUBLIC_COMMANDS = frozenset(
    (
        "init",
        "ingest",
        "garden",
        "sync",
        "list",
        "search",
        "show",
        "topics",
        "health",
        "validate",
        "reindex",
        "serve",
        "tag",
        "untag",
        "config",
        "setup",
        "uninstall",
        "doctor",
        "update",
        "jobs",
        "automation",
    )
)


def command_action(args: argparse.Namespace) -> tuple[str, str] | None:
    command = args.command
    if command not in PUBLIC_COMMANDS:
        return None
    if command == "sync":
        return command, args.sync_command or "run"
    if command == "topics":
        return command, args.topic_command or "list"
    if command == "config":
        return command, args.config_command
    if command == "jobs":
        return command, args.jobs_command or "list"
    if command == "automation":
        return command, args.automation_command
    if command == "update":
        if args.scheduled:
            return command, "scheduled"
        if args.check:
            return command, "check"
        return command, "run"
    return command, command


def capture_command(
    telemetry: TelemetryService,
    args: argparse.Namespace,
    *,
    outcome: str,
    exit_code: int,
    duration_seconds: float,
) -> None:
    normalized = command_action(args)
    if normalized is None:
        return
    command, action = normalized
    telemetry.capture_command(
        CliCommandCompletedProperties(
            command=command,
            action=action,
            outcome=outcome,
            exit_code=exit_code,
            duration_bucket=duration_bucket(duration_seconds),
            interactive=sys.stdout.isatty(),
        )
    )

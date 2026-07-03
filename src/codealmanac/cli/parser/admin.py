import argparse

from codealmanac.cli.parser.automation import add_automation_commands
from codealmanac.cli.parser.capture import add_capture_commands
from codealmanac.cli.parser.cloud_auth import add_cloud_auth_commands
from codealmanac.cli.parser.cloud_status import add_cloud_status_command
from codealmanac.cli.parser.diagnostics import add_diagnostics_commands
from codealmanac.cli.parser.jobs import add_jobs_commands
from codealmanac.cli.parser.repo import add_repo_commands
from codealmanac.cli.parser.runs import add_runs_commands
from codealmanac.cli.parser.setup import add_setup_command, add_uninstall_command
from codealmanac.cli.parser.updates import add_update_commands


def add_cloud_commands(subcommands: argparse._SubParsersAction) -> None:
    add_setup_command(subcommands)
    add_cloud_status_command(subcommands)
    add_uninstall_command(subcommands)
    add_cloud_auth_commands(subcommands)
    add_capture_commands(subcommands)
    add_repo_commands(subcommands)
    add_runs_commands(subcommands)


def add_admin_commands(subcommands: argparse._SubParsersAction) -> None:
    add_diagnostics_commands(subcommands)
    add_update_commands(subcommands)
    add_automation_commands(subcommands)
    add_jobs_commands(subcommands)

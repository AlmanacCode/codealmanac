import argparse

from codealmanac.cli.parser.automation import add_automation_commands
from codealmanac.cli.parser.capture import add_capture_commands
from codealmanac.cli.parser.cloud_auth import add_cloud_auth_commands
from codealmanac.cli.parser.diagnostics import add_diagnostics_commands
from codealmanac.cli.parser.jobs import add_jobs_commands
from codealmanac.cli.parser.setup import add_setup_commands
from codealmanac.cli.parser.updates import add_update_commands


def add_admin_commands(subcommands: argparse._SubParsersAction) -> None:
    add_cloud_auth_commands(subcommands)
    add_capture_commands(subcommands)
    add_setup_commands(subcommands)
    add_diagnostics_commands(subcommands)
    add_update_commands(subcommands)
    add_jobs_commands(subcommands)
    add_automation_commands(subcommands)

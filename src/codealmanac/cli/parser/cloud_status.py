import argparse

from codealmanac.cli.parser.cloud_auth import add_api_url


def add_cloud_status_command(subcommands: argparse._SubParsersAction) -> None:
    status = subcommands.add_parser("status", help="show cloud setup status")
    add_api_url(status)
    status.add_argument(
        "--check-cloud",
        action="store_true",
        help="also check remote capture credentials",
    )
    status.add_argument("--json", action="store_true")

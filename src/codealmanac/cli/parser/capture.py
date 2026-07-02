import argparse

from codealmanac.services.cloud_auth.models import DEFAULT_CLOUD_API_URL


def add_capture_commands(subcommands: argparse._SubParsersAction) -> None:
    capture = subcommands.add_parser(
        "capture",
        help="manage cloud conversation capture",
    )
    capture_subcommands = capture.add_subparsers(
        dest="capture_command",
        metavar="command",
        required=True,
    )

    status = capture_subcommands.add_parser("status", help="show capture status")
    add_api_url(status)
    status.add_argument(
        "--check-cloud",
        action="store_true",
        help="validate capture state against the cloud API",
    )
    status.add_argument("--json", action="store_true")

    enable = capture_subcommands.add_parser("enable", help="enable capture hooks")
    add_api_url(enable)
    add_target(enable)
    enable.add_argument("--json", action="store_true")

    repair = capture_subcommands.add_parser("repair", help="repair capture hooks")
    add_api_url(repair)
    add_target(repair)
    repair.add_argument("--json", action="store_true")

    disable = capture_subcommands.add_parser("disable", help="disable capture hooks")
    add_api_url(disable)
    add_target(disable)
    disable.add_argument(
        "--keep-credential",
        action="store_true",
        help="remove hooks without revoking the capture credential",
    )
    disable.add_argument("--json", action="store_true")

    capture_hook = subcommands.add_parser("__capture-hook", help=argparse.SUPPRESS)
    capture_hook.add_argument("--provider", choices=("codex", "claude"), required=True)


def add_api_url(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--api-url",
        default=DEFAULT_CLOUD_API_URL,
        help="CodeAlmanac cloud API URL",
    )


def add_target(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--target",
        choices=("all", "codex", "claude"),
        default="all",
        help="capture provider to configure",
    )

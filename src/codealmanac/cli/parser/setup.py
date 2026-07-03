import argparse

from codealmanac.cli.parser.cloud_auth import add_api_url

SETUP_TARGETS = ("all", "codex", "claude")
SETUP_HELP = "set up CodeAlmanac cloud and local agent instructions"


def add_setup_commands(subcommands: argparse._SubParsersAction) -> None:
    setup = subcommands.add_parser("setup", help=SETUP_HELP)
    add_api_url(setup)
    setup.add_argument(
        "--no-browser",
        action="store_true",
        help="print the login URL without opening a browser",
    )
    setup.add_argument(
        "--login-timeout",
        type=float,
        default=120.0,
        help="seconds to wait for browser approval",
    )
    setup.add_argument(
        "--login-poll-every",
        type=float,
        default=2.0,
        help="seconds between login polling attempts",
    )
    setup.add_argument("--skip-login", action="store_true", help="skip cloud login")
    setup.add_argument(
        "--target",
        choices=SETUP_TARGETS,
        default="all",
        help="agent instruction target to configure",
    )
    setup.add_argument("--yes", action="store_true", help="run without prompts")
    setup.add_argument(
        "--skip-instructions",
        action="store_true",
        help="skip global agent instruction installation",
    )
    setup.add_argument("--json", action="store_true")

    uninstall = subcommands.add_parser(
        "uninstall",
        help="remove setup-owned local artifacts",
    )
    uninstall.add_argument(
        "--target",
        choices=SETUP_TARGETS,
        default="all",
        help="agent instruction target to remove",
    )
    uninstall.add_argument("--yes", action="store_true", help="run without prompts")
    uninstall.add_argument(
        "--keep-instructions",
        action="store_true",
        help="leave global agent instructions installed",
    )
    uninstall.add_argument(
        "--keep-automation",
        action="store_true",
        help="leave scheduled automation installed",
    )
    uninstall.add_argument("--json", action="store_true")

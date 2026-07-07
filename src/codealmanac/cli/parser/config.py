import argparse


def add_config_commands(subcommands: argparse._SubParsersAction) -> None:
    config = subcommands.add_parser("config", help="manage config")
    config_subcommands = config.add_subparsers(dest="config_command", required=True)
    list_parser = config_subcommands.add_parser("list", help="list config values")
    list_parser.add_argument("--json", action="store_true")
    get_parser = config_subcommands.add_parser("get", help="get a config value")
    get_parser.add_argument(
        "key",
        choices=("auto_commit", "harness.default", "harness.model"),
    )
    get_parser.add_argument("--json", action="store_true")
    set_parser = config_subcommands.add_parser("set", help="set a user config value")
    set_parser.add_argument(
        "key",
        choices=("auto_commit", "harness.default", "harness.model"),
    )
    set_parser.add_argument("value")
    set_parser.add_argument("--json", action="store_true")

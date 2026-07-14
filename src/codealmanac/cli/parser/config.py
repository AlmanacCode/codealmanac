import argparse

from codealmanac.services.config.models import ConfigKey

CONFIG_KEYS = tuple(key.value for key in ConfigKey)


def add_config_commands(subcommands: argparse._SubParsersAction) -> None:
    config = subcommands.add_parser("config", help="manage config")
    config_subcommands = config.add_subparsers(dest="config_command", required=True)
    list_parser = config_subcommands.add_parser("list", help="list config values")
    list_parser.add_argument("--json", action="store_true")
    get_parser = config_subcommands.add_parser("get", help="get a config value")
    get_parser.add_argument(
        "key",
        choices=CONFIG_KEYS,
    )
    get_parser.add_argument("--json", action="store_true")
    set_parser = config_subcommands.add_parser("set", help="set a user config value")
    set_parser.add_argument(
        "key",
        choices=CONFIG_KEYS,
    )
    set_parser.add_argument("value")
    set_parser.add_argument("--json", action="store_true")
    apply_parser = config_subcommands.add_parser(
        "apply",
        help="apply user config to machine automation",
    )
    apply_parser.add_argument("--json", action="store_true")

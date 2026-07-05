import argparse


def add_diagnostics_commands(subcommands: argparse._SubParsersAction) -> None:
    doctor = subcommands.add_parser("doctor", help="check local install and wiki")
    doctor.add_argument("--wiki")
    doctor.add_argument("--harnesses", action="store_true")
    doctor.add_argument("--json", action="store_true")

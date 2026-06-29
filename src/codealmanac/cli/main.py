import argparse
import sys
from collections.abc import Sequence

from pydantic import ValidationError

from codealmanac.app import create_app
from codealmanac.cli.dispatch.root import dispatch as dispatch_app
from codealmanac.cli.parser.root import build_parser
from codealmanac.core.errors import CodeAlmanacError


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return dispatch(args)
    except (CodeAlmanacError, ValidationError) as error:
        print(f"codealmanac: {error}", file=sys.stderr)
        return 1


def dispatch(args: argparse.Namespace) -> int:
    return dispatch_app(args, create_app())


if __name__ == "__main__":
    raise SystemExit(main())

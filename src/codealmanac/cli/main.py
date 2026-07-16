import time
from collections.abc import Sequence

from codealmanac.app import create_app
from codealmanac.cli.execution import execute
from codealmanac.cli.parser.root import build_parser
from codealmanac.cli.render.syntax import render_syntax_problem
from codealmanac.cli.syntax.models import CliSyntaxError


def main(argv: Sequence[str] | None = None) -> int:
    started_at = time.monotonic()
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except CliSyntaxError as error:
        render_syntax_problem(error.problem)
        return 2
    return execute(args, create_app(), started_at)


if __name__ == "__main__":
    raise SystemExit(main())

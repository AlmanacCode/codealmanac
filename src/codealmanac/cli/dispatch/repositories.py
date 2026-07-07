import argparse

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.root import render_repository_list


def dispatch_repositories(args: argparse.Namespace, app: CodeAlmanac) -> int:
    render_repository_list(app.repositories.list_registered(), json_output=args.json)
    return 0

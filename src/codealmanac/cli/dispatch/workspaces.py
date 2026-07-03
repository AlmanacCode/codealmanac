import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.root import render_workspace_drop, render_workspace_list
from codealmanac.wiki.workspaces.requests import DropWorkspaceRequest


def dispatch_workspaces(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.drop is not None:
        result = app.workspaces.drop(
            DropWorkspaceRequest(selector=args.drop, base_path=Path.cwd())
        )
        render_workspace_drop(result, json_output=args.json)
        return 0
    if args.drop_missing:
        result = app.workspaces.drop_missing()
        render_workspace_drop(result, json_output=args.json)
        return 0
    render_workspace_list(app.workspaces.list_registry(), json_output=args.json)
    return 0

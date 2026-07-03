import sys

from codealmanac.cli.render.common import print_json_model, print_json_rows
from codealmanac.wiki.workspaces.models import (
    DropWorkspaceResult,
    WorkspaceListResult,
)


def render_workspace_list(result: WorkspaceListResult, json_output: bool) -> None:
    if json_output:
        print_json_rows(result.items)
        return
    for item in result.items:
        workspace = item.workspace
        print(
            f"{workspace.name}\t{workspace.root_path}\t"
            f"{workspace.almanac_root.as_posix()}"
        )


def render_workspace_drop(result: DropWorkspaceResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    if len(result.dropped) == 0:
        print("# 0 wikis dropped", file=sys.stderr)
        return
    for workspace in result.dropped:
        print(
            f"dropped {workspace.name}\t{workspace.root_path}\t"
            f"{workspace.almanac_root.as_posix()}"
        )

import sys

from codealmanac.cli.render.common import (
    index_summary,
    print_json_model,
    print_json_rows,
)
from codealmanac.wiki.index.models import IndexRefreshResult, SearchPageResult


def render_search(rows: tuple[SearchPageResult, ...], json_output: bool) -> None:
    if json_output:
        print_json_rows(rows)
        return
    if len(rows) == 0:
        print("# 0 results", file=sys.stderr)
        return
    for row in rows:
        print(row.slug)


def render_reindex(result: IndexRefreshResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    print(f"reindexed: {index_summary(result)}")

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from pydantic import ValidationError

from codealmanac import __version__
from codealmanac.app import create_app
from codealmanac.core.errors import CodeAlmanacError
from codealmanac.services.index.models import PageView, SearchPageResult
from codealmanac.services.pages.requests import ShowPageRequest
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.services.workspaces.requests import InitializeWorkspaceRequest


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return dispatch(args)
    except (CodeAlmanacError, ValidationError) as error:
        print(f"codealmanac: {error}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codealmanac",
        description="Maintain a local .almanac wiki for a codebase.",
    )
    parser.add_argument("--version", action="version", version=__version__)
    subcommands = parser.add_subparsers(dest="command", required=True)

    init = subcommands.add_parser("init", help="initialize a local .almanac wiki")
    init.add_argument("path", nargs="?", default=".")
    init.add_argument("--name")
    init.add_argument("--description", default="")

    subcommands.add_parser("list", help="list registered local wikis")

    search = subcommands.add_parser("search", help="search the local wiki")
    search.add_argument("query", nargs="?")
    search.add_argument("--wiki")
    search.add_argument("--topic", action="append", default=[])
    search.add_argument("--mentions")
    search.add_argument("--include-archive", action="store_true")
    search.add_argument("--archived", action="store_true")
    search.add_argument("--limit", type=int)
    search.add_argument("--json", action="store_true")

    show = subcommands.add_parser("show", help="show a wiki page")
    show.add_argument("slug")
    show.add_argument("--wiki")
    show.add_argument("--json", action="store_true")
    show.add_argument("--body", action="store_true")
    show.add_argument("--meta", action="store_true")
    show.add_argument("--lead", action="store_true")
    show.add_argument("--links", action="store_true")
    show.add_argument("--backlinks", action="store_true")
    show.add_argument("--files", action="store_true")
    show.add_argument("--topics", action="store_true")
    return parser


def dispatch(args: argparse.Namespace) -> int:
    app = create_app()
    if args.command == "init":
        workspace = app.build.initialize(
            InitializeWorkspaceRequest(
                path=Path(args.path),
                name=args.name,
                description=args.description,
            )
        )
        print(workspace.name)
        print(
            f"initialized {workspace.almanac_path} "
            f"(registry: {app.workspaces.store.path})",
            file=sys.stderr,
        )
        return 0
    if args.command == "list":
        for workspace in app.workspaces.list():
            print(f"{workspace.name}\t{workspace.root_path}")
        return 0
    if args.command == "search":
        rows = app.search.search(
            SearchPagesRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                query=args.query,
                topics=tuple(args.topic),
                mentions=args.mentions,
                include_archive=args.include_archive,
                archived=args.archived,
                limit=args.limit,
            )
        )
        render_search(rows, json_output=args.json)
        return 0
    if args.command == "show":
        page = app.pages.show(
            ShowPageRequest(cwd=Path.cwd(), wiki=args.wiki, slug=args.slug)
        )
        render_page(page, args)
        return 0
    raise AssertionError(f"unhandled command: {args.command}")


def render_search(rows: tuple[SearchPageResult, ...], json_output: bool) -> None:
    if json_output:
        data = [row.model_dump(mode="json") for row in rows]
        print(json.dumps(data, indent=2))
        return
    if len(rows) == 0:
        print("# 0 results", file=sys.stderr)
        return
    for row in rows:
        print(row.slug)


def render_page(page: PageView, args: argparse.Namespace) -> None:
    if args.json:
        print(json.dumps(page.model_dump(mode="json"), indent=2))
        return
    if args.body:
        print(body_with_trailing_newline(page.body), end="")
        return
    if args.links:
        print_lines(page.wikilinks_out)
        return
    if args.backlinks:
        print_lines(page.wikilinks_in)
        return
    if args.files:
        print_lines(tuple(ref.path for ref in page.file_refs))
        return
    if args.topics:
        print_lines(page.topics)
        return
    if args.meta:
        print(metadata_header(page))
        return
    if args.lead:
        print(first_paragraph(page.body))
        return
    print(body_with_trailing_newline(page.body), end="")


def print_lines(values: tuple[str, ...]) -> None:
    for value in values:
        print(value)


def metadata_header(page: PageView) -> str:
    lines = [
        f"slug: {page.slug}",
        f"title: {page.title or ''}",
        f"path: {page.file_path}",
    ]
    if page.summary:
        lines.append(f"summary: {page.summary}")
    if page.topics:
        lines.append(f"topics: {', '.join(page.topics)}")
    return "\n".join(lines)


def first_paragraph(body: str) -> str:
    paragraphs = [part.strip() for part in body.split("\n\n") if part.strip()]
    return paragraphs[0] if paragraphs else ""


def body_with_trailing_newline(body: str) -> str:
    if body == "" or body.endswith("\n"):
        return body
    return f"{body}\n"


if __name__ == "__main__":
    raise SystemExit(main())

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from pydantic import ValidationError

from codealmanac import __version__
from codealmanac.app import create_app
from codealmanac.core.errors import CodeAlmanacError
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.index.models import (
    HealthReport,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.pages.requests import ShowPageRequest
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.services.tagging.models import TaggingResult
from codealmanac.services.tagging.requests import TagPageRequest, UntagPageRequest
from codealmanac.services.topics.requests import ListTopicsRequest, ShowTopicRequest
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

    topics = subcommands.add_parser("topics", help="list or inspect topics")
    topics.add_argument("--wiki")
    topic_subcommands = topics.add_subparsers(dest="topic_command")
    topic_show = topic_subcommands.add_parser("show", help="show a topic")
    topic_show.add_argument("slug")
    topic_show.add_argument("--descendants", action="store_true")

    health = subcommands.add_parser("health", help="check wiki health")
    health.add_argument("--wiki")
    health.add_argument("--json", action="store_true")

    tag = subcommands.add_parser("tag", help="add topics to a page")
    tag.add_argument("slug")
    tag.add_argument("topics", nargs="+")
    tag.add_argument("--wiki")

    untag = subcommands.add_parser("untag", help="remove topics from a page")
    untag.add_argument("slug")
    untag.add_argument("topics", nargs="+")
    untag.add_argument("--wiki")
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
    if args.command == "topics":
        if args.topic_command == "show":
            topic = app.topics.show(
                ShowTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    slug=args.slug,
                    include_descendants=args.descendants,
                )
            )
            render_topic(topic)
            return 0
        topics = app.topics.list(ListTopicsRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_topics(topics)
        return 0
    if args.command == "health":
        report = app.health.check(HealthCheckRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_health(report, json_output=args.json)
        return 0
    if args.command == "tag":
        result = app.tagging.tag(
            TagPageRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                slug=args.slug,
                topics=tuple(args.topics),
            )
        )
        render_tagging("tagged", "already tagged", result)
        return 0
    if args.command == "untag":
        result = app.tagging.untag(
            UntagPageRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                slug=args.slug,
                topics=tuple(args.topics),
            )
        )
        render_tagging("untagged", "not tagged", result)
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


def render_topics(rows: tuple[TopicSummary, ...]) -> None:
    for row in rows:
        title = row.title or row.slug
        print(f"{row.slug}\t{row.page_count}\t{title}")


def render_topic(topic: TopicDetail) -> None:
    print(f"slug: {topic.slug}")
    print(f"title: {topic.title or ''}")
    if topic.description:
        print(f"description: {topic.description}")
    if topic.parents:
        print(f"parents: {', '.join(topic.parents)}")
    if topic.children:
        print(f"children: {', '.join(topic.children)}")
    if topic.pages:
        print("pages:")
        for slug in topic.pages:
            print(f"  {slug}")
    else:
        print("pages: none")


def render_health(report: HealthReport, json_output: bool) -> None:
    if json_output:
        print(json.dumps(report.model_dump(mode="json"), indent=2))
        return
    render_health_section("orphans", tuple(item.slug for item in report.orphans))
    render_health_section(
        "dead_refs",
        tuple(f"{item.slug}\t{item.path}" for item in report.dead_refs),
    )
    render_health_section(
        "broken_links",
        tuple(
            f"{item.source_slug}\t{item.target_slug}" for item in report.broken_links
        ),
    )
    render_health_section(
        "broken_xwiki",
        tuple(
            f"{item.source_slug}\t{item.target_wiki}:{item.target_slug}"
            for item in report.broken_xwiki
        ),
    )
    render_health_section(
        "empty_topics",
        tuple(item.slug for item in report.empty_topics),
    )
    render_health_section(
        "empty_pages",
        tuple(item.slug for item in report.empty_pages),
    )


def render_health_section(name: str, rows: tuple[str, ...]) -> None:
    if not rows:
        print(f"{name} (0): ok")
        return
    print(f"{name} ({len(rows)}):")
    for row in rows:
        print(f"  {row}")


def render_tagging(changed_label: str, unchanged_label: str, result: TaggingResult):
    if result.changed_topics:
        print(f"{result.slug}: {changed_label} {', '.join(result.changed_topics)}")
        return
    unchanged = ", ".join(result.requested_topics)
    print(f"{result.slug}: {unchanged_label} {unchanged}")


if __name__ == "__main__":
    raise SystemExit(main())

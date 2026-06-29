import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from pydantic import ValidationError

from codealmanac import __version__
from codealmanac.app import create_app
from codealmanac.core.errors import CodeAlmanacError
from codealmanac.services.diagnostics.models import (
    DoctorCheck,
    DoctorReport,
)
from codealmanac.services.diagnostics.requests import DoctorRequest
from codealmanac.services.health.requests import HealthCheckRequest
from codealmanac.services.index.models import (
    HealthReport,
    IndexRefreshResult,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.index.requests import ReindexRequest
from codealmanac.services.pages.requests import ShowPageRequest
from codealmanac.services.search.requests import SearchPagesRequest
from codealmanac.services.tagging.models import TaggingResult
from codealmanac.services.tagging.requests import TagPageRequest, UntagPageRequest
from codealmanac.services.topics.models import (
    TopicEdgeMutationResult,
    TopicMutationAction,
    TopicMutationResult,
    TopicRewriteMutationResult,
)
from codealmanac.services.topics.requests import (
    CreateTopicRequest,
    DeleteTopicRequest,
    DescribeTopicRequest,
    LinkTopicRequest,
    ListTopicsRequest,
    RenameTopicRequest,
    ShowTopicRequest,
    UnlinkTopicRequest,
)
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

    build = subcommands.add_parser("build", help="build or refresh a local wiki")
    build.add_argument("path", nargs="?", default=".")
    build.add_argument("--name")
    build.add_argument("--description", default="")

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
    topic_create = topic_subcommands.add_parser("create", help="create a topic")
    topic_create.add_argument("name")
    topic_create.add_argument("--parent", action="append", default=[])
    topic_describe = topic_subcommands.add_parser(
        "describe",
        help="set a topic description",
    )
    topic_describe.add_argument("slug")
    topic_describe.add_argument("description")
    topic_link = topic_subcommands.add_parser("link", help="link topic to parent")
    topic_link.add_argument("child")
    topic_link.add_argument("parent")
    topic_unlink = topic_subcommands.add_parser(
        "unlink",
        help="unlink topic from parent",
    )
    topic_unlink.add_argument("child")
    topic_unlink.add_argument("parent")
    topic_rename = topic_subcommands.add_parser("rename", help="rename a topic")
    topic_rename.add_argument("old_slug")
    topic_rename.add_argument("new_slug")
    topic_delete = topic_subcommands.add_parser("delete", help="delete a topic")
    topic_delete.add_argument("slug")

    health = subcommands.add_parser("health", help="check wiki health")
    health.add_argument("--wiki")
    health.add_argument("--json", action="store_true")

    reindex = subcommands.add_parser("reindex", help="force a full index rebuild")
    reindex.add_argument("--wiki")
    reindex.add_argument("--json", action="store_true")

    doctor = subcommands.add_parser("doctor", help="check local install and wiki")
    doctor.add_argument("--wiki")
    doctor.add_argument("--json", action="store_true")

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
    if args.command == "build":
        result = app.build.build(
            InitializeWorkspaceRequest(
                path=Path(args.path),
                name=args.name,
                description=args.description,
            )
        )
        render_build(result.workspace.name, result.index)
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
        if args.topic_command == "create":
            result = app.topics.create(
                CreateTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    name=args.name,
                    parents=tuple(args.parent),
                )
            )
            render_topic_mutation(result)
            return 0
        if args.topic_command == "describe":
            result = app.topics.describe(
                DescribeTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    slug=args.slug,
                    description=args.description,
                )
            )
            render_topic_mutation(result)
            return 0
        if args.topic_command == "link":
            result = app.topics.link(
                LinkTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    child=args.child,
                    parent=args.parent,
                )
            )
            render_topic_edge_mutation(result)
            return 0
        if args.topic_command == "unlink":
            result = app.topics.unlink(
                UnlinkTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    child=args.child,
                    parent=args.parent,
                )
            )
            render_topic_edge_mutation(result)
            return 0
        if args.topic_command == "rename":
            result = app.topics.rename(
                RenameTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    old_slug=args.old_slug,
                    new_slug=args.new_slug,
                )
            )
            render_topic_rewrite_mutation(result)
            return 0
        if args.topic_command == "delete":
            result = app.topics.delete(
                DeleteTopicRequest(
                    cwd=Path.cwd(),
                    wiki=args.wiki,
                    slug=args.slug,
                )
            )
            render_topic_rewrite_mutation(result)
            return 0
        topics = app.topics.list(ListTopicsRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_topics(topics)
        return 0
    if args.command == "health":
        report = app.health.check(HealthCheckRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_health(report, json_output=args.json)
        return 0
    if args.command == "reindex":
        result = app.index.reindex(ReindexRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_reindex(result, json_output=args.json)
        return 0
    if args.command == "doctor":
        report = app.diagnostics.check(DoctorRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_doctor(report, json_output=args.json)
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


def render_build(workspace_name: str, result: IndexRefreshResult) -> None:
    print(f"built {workspace_name}: {index_summary(result)}")


def render_reindex(result: IndexRefreshResult, json_output: bool) -> None:
    if json_output:
        print(json.dumps(result.model_dump(mode="json"), indent=2))
        return
    print(f"reindexed: {index_summary(result)}")


def index_summary(result: IndexRefreshResult) -> str:
    skip_suffix = (
        f"; {result.files_skipped} skipped" if result.files_skipped > 0 else ""
    )
    return (
        f"{result.pages_indexed} {page_word(result.pages_indexed)} "
        f"({result.changed} updated, {result.removed} removed{skip_suffix})"
    )


def render_doctor(report: DoctorReport, json_output: bool) -> None:
    if json_output:
        print(json.dumps(report.model_dump(mode="json"), indent=2))
        return
    print(f"codealmanac v{report.version}")
    print("")
    render_doctor_section("Install", report.install)
    render_doctor_section("Current wiki", report.wiki)


def render_doctor_section(title: str, checks: tuple[DoctorCheck, ...]) -> None:
    if len(checks) == 0:
        return
    print(f"## {title}")
    for check in checks:
        print(f"  {check.status.value} {check.message}")
        if check.fix is not None:
            print(f"    {check.fix}")
    print("")


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


def render_topic_mutation(result: TopicMutationResult) -> None:
    print(f"{result.slug}: {result.action.value}")


def render_topic_edge_mutation(result: TopicEdgeMutationResult) -> None:
    if result.action == TopicMutationAction.NO_EDGE:
        print(f"no edge {result.child} -> {result.parent}")
        return
    if result.action == TopicMutationAction.ALREADY_LINKED:
        print(f"edge {result.child} -> {result.parent} already exists")
        return
    print(f"{result.action.value} {result.child} -> {result.parent}")


def render_topic_rewrite_mutation(result: TopicRewriteMutationResult) -> None:
    if result.action == TopicMutationAction.UNCHANGED:
        print(f"topic {result.slug} unchanged")
        return
    if result.action == TopicMutationAction.RENAMED:
        print(
            f"renamed {result.slug} -> {result.new_slug} "
            f"({result.pages_updated} {page_word(result.pages_updated)} updated)"
        )
        return
    if result.action == TopicMutationAction.DELETED:
        print(
            f"deleted {result.slug} "
            f"({result.pages_updated} {page_word(result.pages_updated)} untagged)"
        )
        return
    print(f"{result.slug}: {result.action.value}")


def page_word(count: int) -> str:
    return "page" if count == 1 else "pages"


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

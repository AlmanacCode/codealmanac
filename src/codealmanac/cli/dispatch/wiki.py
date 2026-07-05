import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.dispatch.serve import run_serve
from codealmanac.cli.dispatch.topics import dispatch_topics
from codealmanac.cli.dispatch.workspaces import dispatch_workspaces
from codealmanac.cli.render.root import (
    render_health,
    render_page,
    render_reindex,
    render_search,
    render_tagging,
)
from codealmanac.cli.render.validation import render_validation
from codealmanac.wiki.health.requests import HealthCheckRequest
from codealmanac.wiki.index.requests import ReindexRequest
from codealmanac.wiki.pages.requests import ShowPageRequest
from codealmanac.wiki.search.requests import SearchPagesRequest
from codealmanac.wiki.tagging.requests import TagPageRequest, UntagPageRequest
from codealmanac.wiki.validation.requests import ValidateWikiRequest

WIKI_COMMANDS = frozenset(
    (
        "health",
        "list",
        "reindex",
        "search",
        "serve",
        "show",
        "tag",
        "topics",
        "untag",
        "validate",
    )
)


def is_wiki_command(command: str | None) -> bool:
    return command in WIKI_COMMANDS


def dispatch_wiki(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.command == "list":
        return dispatch_workspaces(args, app)
    if args.command == "search":
        rows = app.search.search(
            SearchPagesRequest(
                cwd=Path.cwd(),
                wiki=args.wiki,
                query=args.query,
                topics=tuple(args.topic),
                mentions=args.mentions,
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
        return dispatch_topics(args, app)
    if args.command == "health":
        report = app.health.check(HealthCheckRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_health(report, json_output=args.json)
        return 0
    if args.command == "validate":
        report = app.validation.check(
            ValidateWikiRequest(cwd=Path.cwd(), wiki=args.wiki)
        )
        render_validation(report, json_output=args.json)
        return 0 if report.ok else 1
    if args.command == "reindex":
        result = app.index.reindex(ReindexRequest(cwd=Path.cwd(), wiki=args.wiki))
        render_reindex(result, json_output=args.json)
        return 0
    if args.command == "serve":
        return run_serve(app, args)
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
    raise AssertionError(f"unhandled wiki command: {args.command}")

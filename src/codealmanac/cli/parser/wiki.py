import argparse

DEFAULT_VIEWER_HOST = "127.0.0.1"
DEFAULT_VIEWER_PORT = 3927


def add_wiki_commands(subcommands: argparse._SubParsersAction) -> None:
    list_parser = subcommands.add_parser("list", help="list registered local wikis")
    list_parser.add_argument("--json", action="store_true")
    list_actions = list_parser.add_mutually_exclusive_group()
    list_actions.add_argument("--drop")
    list_actions.add_argument("--drop-missing", action="store_true")

    search = subcommands.add_parser("search", help="search the local wiki")
    search.add_argument("query", nargs="?")
    search.add_argument("--wiki")
    search.add_argument("--topic", action="append", default=[])
    search.add_argument("--mentions")
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

    serve = subcommands.add_parser("serve", help="serve the local wiki viewer")
    serve.add_argument("--wiki")
    serve.add_argument("--host", default=DEFAULT_VIEWER_HOST)
    serve.add_argument("--port", type=int, default=DEFAULT_VIEWER_PORT)

    tag = subcommands.add_parser("tag", help="add topics to a page")
    tag.add_argument("slug")
    tag.add_argument("topics", nargs="+")
    tag.add_argument("--wiki")

    untag = subcommands.add_parser("untag", help="remove topics from a page")
    untag.add_argument("slug")
    untag.add_argument("topics", nargs="+")
    untag.add_argument("--wiki")

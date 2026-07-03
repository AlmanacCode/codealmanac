import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.root import (
    render_topic,
    render_topic_edge_mutation,
    render_topic_mutation,
    render_topic_rewrite_mutation,
    render_topics,
)
from codealmanac.wiki.topics.requests import (
    CreateTopicRequest,
    DeleteTopicRequest,
    DescribeTopicRequest,
    LinkTopicRequest,
    ListTopicsRequest,
    RenameTopicRequest,
    ShowTopicRequest,
    UnlinkTopicRequest,
)


def dispatch_topics(args: argparse.Namespace, app: CodeAlmanac) -> int:
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
    return dispatch_topic_rewrite(args, app)


def dispatch_topic_rewrite(args: argparse.Namespace, app: CodeAlmanac) -> int:
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

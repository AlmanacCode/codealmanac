from codealmanac.cli.render.common import page_word
from codealmanac.wiki.index.models import TopicDetail, TopicSummary
from codealmanac.wiki.topics.models import (
    TopicEdgeMutationResult,
    TopicMutationAction,
    TopicMutationResult,
    TopicRewriteMutationResult,
)


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

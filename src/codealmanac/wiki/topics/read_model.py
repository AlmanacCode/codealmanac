from codealmanac.wiki.index.service import IndexService


def existing_topic_slugs(index: IndexService, workspace_id: str) -> set[str]:
    return {topic.slug for topic in index.list_topics(workspace_id)}

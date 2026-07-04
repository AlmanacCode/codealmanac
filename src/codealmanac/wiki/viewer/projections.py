from codealmanac.wiki.index.models import (
    PageSourceReference,
    PageView,
    SearchPageResult,
    TopicSummary,
)
from codealmanac.wiki.viewer.models import (
    ViewerPageSource,
    ViewerPageSummary,
    ViewerTopicSummary,
    ViewerWorkspace,
)
from codealmanac.wiki.workspaces.models import Workspace


def viewer_workspace(workspace: Workspace) -> ViewerWorkspace:
    return ViewerWorkspace(
        workspace_id=workspace.workspace_id,
        name=workspace.name,
        root_path=workspace.root_path,
    )


def viewer_topic_summary(topic: TopicSummary) -> ViewerTopicSummary:
    return ViewerTopicSummary(
        slug=topic.slug,
        title=topic.title,
        description=topic.description,
        page_count=topic.page_count,
    )


def viewer_page_sources(
    sources: tuple[PageSourceReference, ...],
) -> tuple[ViewerPageSource, ...]:
    return tuple(viewer_page_source(source) for source in sources)


def viewer_page_source(source: PageSourceReference) -> ViewerPageSource:
    return ViewerPageSource(
        source_id=source.source_id,
        source_type=source.source_type.value,
        target=source.target,
        title=source.title,
        retrieved_at=source.retrieved_at,
        note=source.note,
    )


def page_summary_from_search(page: SearchPageResult) -> ViewerPageSummary:
    return ViewerPageSummary(
        slug=page.slug,
        title=page.title,
        summary=page.summary,
        path=page.relative_path,
        topics=page.topics,
    )


def page_summary_from_view(page: PageView) -> ViewerPageSummary:
    return ViewerPageSummary(
        slug=page.slug,
        title=page.title,
        summary=page.summary,
        path=page.relative_path,
        topics=page.topics,
    )

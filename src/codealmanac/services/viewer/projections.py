from pathlib import Path

from codealmanac.services.index.models import (
    PageSourceReference,
    PageView,
    SearchPageResult,
    TopicSummary,
)
from codealmanac.services.repositories.models import Repository
from codealmanac.services.viewer.models import (
    ViewerPageSource,
    ViewerPageSummary,
    ViewerRepository,
    ViewerTopicSummary,
)


def viewer_repository(repository: Repository) -> ViewerRepository:
    return ViewerRepository(
        repository_id=repository.repository_id,
        name=repository.name,
        root_path=repository.root_path,
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
    citation_order: tuple[str, ...] = (),
) -> tuple[ViewerPageSource, ...]:
    citation_numbers = {
        source_id: index + 1 for index, source_id in enumerate(citation_order)
    }
    return tuple(
        sorted(
            (
                viewer_page_source(
                    source,
                    citation_number=citation_numbers.get(source.source_id),
                )
                for source in sources
            ),
            key=source_sort_key,
        )
    )


def viewer_page_source(
    source: PageSourceReference,
    citation_number: int | None = None,
) -> ViewerPageSource:
    return ViewerPageSource(
        source_id=source.source_id,
        source_type=source.source_type.value,
        target=source.target,
        title=source.title,
        retrieved_at=source.retrieved_at,
        note=source.note,
        citation_number=citation_number,
    )


def source_sort_key(source: ViewerPageSource) -> tuple[int, int, str]:
    if source.citation_number is None:
        return (1, 0, source.source_id)
    return (0, source.citation_number, source.source_id)


def page_summary_from_search(
    repository: Repository,
    page: SearchPageResult,
) -> ViewerPageSummary:
    return ViewerPageSummary(
        slug=page.slug,
        title=page.title,
        summary=page.summary,
        path=viewer_relative_path(repository, page.file_path),
        topics=page.topics,
    )


def page_summary_from_view(
    repository: Repository,
    page: PageView,
) -> ViewerPageSummary:
    return ViewerPageSummary(
        slug=page.slug,
        title=page.title,
        summary=page.summary,
        path=viewer_relative_path(repository, page.file_path),
        topics=page.topics,
    )


def viewer_relative_path(repository: Repository, path: Path) -> str:
    try:
        normalized = path.relative_to(repository.almanac_path)
    except ValueError:
        normalized = path

    prefix = "pages/"
    relative = normalized.as_posix()
    if relative.startswith(prefix):
        return relative[len(prefix) :]
    return relative

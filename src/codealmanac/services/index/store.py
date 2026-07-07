from pathlib import Path

from codealmanac.core.errors import NotFoundError
from codealmanac.services.index.models import (
    HealthReport,
    IndexCounts,
    IndexRefreshResult,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.index.projection import (
    replace_documents,
    stored_signature,
)
from codealmanac.services.index.requests import SearchIndexRequest
from codealmanac.services.index.schema import connect_index, index_db_path
from codealmanac.services.index.sources import load_index_sources
from codealmanac.services.index.views import (
    build_health_report,
    get_page_view,
    get_topic_detail,
    index_counts,
    list_topic_summaries,
    search_pages,
)
from codealmanac.services.repositories.roots import is_initialized_almanac_root


class IndexStore:
    def refresh(self, almanac_path: Path, runtime_path: Path) -> IndexRefreshResult:
        require_initialized_almanac_root(almanac_path)
        sources = load_index_sources(almanac_path)
        db_path = index_db_path(runtime_path)
        with connect_index(db_path) as connection:
            if stored_signature(connection) == sources.signature:
                return IndexRefreshResult(
                    changed=0,
                    removed=0,
                    pages_indexed=len(sources.documents),
                    files_seen=sources.files_seen,
                    files_skipped=sources.files_skipped,
                )
            replace_documents(connection, sources)
        return IndexRefreshResult(
            changed=len(sources.documents),
            removed=0,
            pages_indexed=len(sources.documents),
            files_seen=sources.files_seen,
            files_skipped=sources.files_skipped,
        )

    def rebuild(self, almanac_path: Path, runtime_path: Path) -> IndexRefreshResult:
        require_initialized_almanac_root(almanac_path)
        sources = load_index_sources(almanac_path)
        db_path = index_db_path(runtime_path)
        with connect_index(db_path) as connection:
            replace_documents(connection, sources)
        return IndexRefreshResult(
            changed=len(sources.documents),
            removed=0,
            pages_indexed=len(sources.documents),
            files_seen=sources.files_seen,
            files_skipped=sources.files_skipped,
        )

    def search(
        self,
        almanac_path: Path,
        runtime_path: Path,
        request: SearchIndexRequest,
    ) -> tuple[SearchPageResult, ...]:
        require_initialized_almanac_root(almanac_path)
        with connect_index(index_db_path(runtime_path)) as connection:
            return search_pages(connection, request)

    def counts(self, almanac_path: Path, runtime_path: Path) -> IndexCounts:
        require_initialized_almanac_root(almanac_path)
        with connect_index(index_db_path(runtime_path)) as connection:
            return index_counts(connection)

    def get_page(
        self,
        almanac_path: Path,
        runtime_path: Path,
        slug: str,
    ) -> PageView | None:
        require_initialized_almanac_root(almanac_path)
        with connect_index(index_db_path(runtime_path)) as connection:
            return get_page_view(connection, slug)

    def list_topics(
        self,
        almanac_path: Path,
        runtime_path: Path,
    ) -> tuple[TopicSummary, ...]:
        require_initialized_almanac_root(almanac_path)
        with connect_index(index_db_path(runtime_path)) as connection:
            return list_topic_summaries(connection)

    def get_topic(
        self,
        almanac_path: Path,
        runtime_path: Path,
        slug: str,
        include_descendants: bool,
    ) -> TopicDetail | None:
        require_initialized_almanac_root(almanac_path)
        with connect_index(index_db_path(runtime_path)) as connection:
            return get_topic_detail(connection, slug, include_descendants)

    def health_report(
        self,
        almanac_path: Path,
        runtime_path: Path,
        repository_root: Path,
        registered_wikis: set[str],
    ) -> HealthReport:
        require_initialized_almanac_root(almanac_path)
        with connect_index(index_db_path(runtime_path)) as connection:
            return build_health_report(
                connection,
                repository_root,
                registered_wikis,
            )


def require_initialized_almanac_root(almanac_path: Path) -> None:
    if not is_initialized_almanac_root(almanac_path):
        raise NotFoundError("Almanac root", str(almanac_path))

from pathlib import Path

from codealmanac.database import SQLiteConnection
from codealmanac.services.index.health_graph_views import (
    broken_cross_wiki_links,
    broken_page_links,
    dead_file_refs,
    empty_pages,
    empty_topics,
    orphan_pages,
)
from codealmanac.services.index.health_source_views import (
    duplicate_sources,
    missing_source_citations,
    unused_sources,
)
from codealmanac.services.index.models import HealthReport


def build_health_report(
    connection: SQLiteConnection,
    repository_root: Path,
    registered_wikis: set[str],
) -> HealthReport:
    return HealthReport(
        orphans=orphan_pages(connection),
        dead_refs=dead_file_refs(connection, repository_root),
        broken_links=broken_page_links(connection),
        broken_xwiki=broken_cross_wiki_links(connection, registered_wikis),
        empty_topics=empty_topics(connection),
        empty_pages=empty_pages(connection),
        missing_source_citations=missing_source_citations(connection),
        unused_sources=unused_sources(connection),
        duplicate_sources=duplicate_sources(connection),
    )

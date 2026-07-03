import re

from codealmanac.database import SQLiteConnection, SQLiteRow
from codealmanac.wiki.index.models import (
    DuplicatePageSource,
    MissingSourceCitation,
    UnusedPageSource,
)


def missing_source_citations(
    connection: SQLiteConnection,
) -> tuple[MissingSourceCitation, ...]:
    findings: list[MissingSourceCitation] = []
    for page in source_health_pages(connection):
        cited_ids = citation_ids(page["body"])
        if not cited_ids:
            continue
        source_ids = source_ids_for_page(connection, page["slug"])
        for source_id in sorted(cited_ids - source_ids):
            findings.append(
                MissingSourceCitation(slug=page["slug"], source_id=source_id)
            )
    return tuple(findings)


def unused_sources(connection: SQLiteConnection) -> tuple[UnusedPageSource, ...]:
    findings: list[UnusedPageSource] = []
    for page in source_health_pages(connection):
        cited_ids = citation_ids(page["body"])
        source_ids = source_ids_for_page(connection, page["slug"])
        for source_id in sorted(source_ids - cited_ids):
            findings.append(UnusedPageSource(slug=page["slug"], source_id=source_id))
    return tuple(findings)


def duplicate_sources(connection: SQLiteConnection) -> tuple[DuplicatePageSource, ...]:
    rows = connection.execute(
        """
        SELECT p.slug, s.source_id
        FROM page_sources s
        JOIN pages p ON p.slug = s.page_slug
        GROUP BY p.slug, s.source_id
        HAVING COUNT(*) > 1
        ORDER BY p.slug, s.source_id
        """
    ).fetchall()
    return tuple(
        DuplicatePageSource(slug=row["slug"], source_id=row["source_id"])
        for row in rows
    )


def source_health_pages(connection: SQLiteConnection) -> tuple[SQLiteRow, ...]:
    rows = connection.execute(
        """
        SELECT slug, body
        FROM pages
        ORDER BY slug
        """
    ).fetchall()
    return tuple(rows)


def source_ids_for_page(connection: SQLiteConnection, slug: str) -> set[str]:
    rows = connection.execute(
        "SELECT source_id FROM page_sources WHERE page_slug = ?",
        (slug,),
    ).fetchall()
    return {row["source_id"] for row in rows}


def citation_ids(body: str) -> set[str]:
    return set(re.findall(r"\[@([A-Za-z0-9][A-Za-z0-9_.:-]*)\]", body))

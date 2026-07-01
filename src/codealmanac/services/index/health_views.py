import re
from pathlib import Path

from codealmanac.database import SQLiteConnection, SQLiteRow
from codealmanac.services.index.models import (
    BrokenCrossWikiLink,
    BrokenPageLink,
    DeadFileReference,
    DuplicatePageSource,
    EmptyPage,
    EmptyTopic,
    HealthReport,
    MissingSourceCitation,
    OrphanPage,
    UnusedPageSource,
)


def build_health_report(
    connection: SQLiteConnection,
    repo_root: Path,
    registered_wikis: set[str],
) -> HealthReport:
    return HealthReport(
        orphans=orphan_pages(connection),
        dead_refs=dead_file_refs(connection, repo_root),
        broken_links=broken_page_links(connection),
        broken_xwiki=broken_cross_wiki_links(connection, registered_wikis),
        empty_topics=empty_topics(connection),
        empty_pages=empty_pages(connection),
        missing_source_citations=missing_source_citations(connection),
        unused_sources=unused_sources(connection),
        duplicate_sources=duplicate_sources(connection),
    )


def orphan_pages(connection: SQLiteConnection) -> tuple[OrphanPage, ...]:
    rows = connection.execute(
        """
        SELECT p.slug
        FROM pages p
        WHERE NOT EXISTS (
            SELECT 1 FROM page_topics pt WHERE pt.page_slug = p.slug
          )
        ORDER BY p.slug
        """
    ).fetchall()
    return tuple(OrphanPage(slug=row["slug"]) for row in rows)


def dead_file_refs(
    connection: SQLiteConnection,
    repo_root: Path,
) -> tuple[DeadFileReference, ...]:
    rows = connection.execute(
        """
        SELECT p.slug, r.original_path, r.is_dir
        FROM pages p
        JOIN file_refs r ON r.page_slug = p.slug
        ORDER BY p.slug, r.original_path
        """
    ).fetchall()
    findings: list[DeadFileReference] = []
    for row in rows:
        path = repo_root / row["original_path"]
        exists = path.is_dir() if row["is_dir"] else path.is_file()
        if not exists:
            findings.append(
                DeadFileReference(slug=row["slug"], path=row["original_path"])
            )
    return tuple(findings)


def broken_page_links(connection: SQLiteConnection) -> tuple[BrokenPageLink, ...]:
    rows = connection.execute(
        """
        SELECT w.source_slug, w.target_slug
        FROM wikilinks w
        JOIN pages source ON source.slug = w.source_slug
        LEFT JOIN pages target ON target.slug = w.target_slug
        WHERE target.slug IS NULL
        ORDER BY w.source_slug, w.target_slug
        """
    ).fetchall()
    return tuple(
        BrokenPageLink(
            source_slug=row["source_slug"],
            target_slug=row["target_slug"],
        )
        for row in rows
    )


def broken_cross_wiki_links(
    connection: SQLiteConnection,
    registered_wikis: set[str],
) -> tuple[BrokenCrossWikiLink, ...]:
    rows = connection.execute(
        """
        SELECT x.source_slug, x.target_wiki, x.target_slug
        FROM cross_wiki_links x
        JOIN pages source ON source.slug = x.source_slug
        ORDER BY x.source_slug, x.target_wiki, x.target_slug
        """
    ).fetchall()
    return tuple(
        BrokenCrossWikiLink(
            source_slug=row["source_slug"],
            target_wiki=row["target_wiki"],
            target_slug=row["target_slug"],
        )
        for row in rows
        if row["target_wiki"] not in registered_wikis
    )


def empty_topics(connection: SQLiteConnection) -> tuple[EmptyTopic, ...]:
    rows = connection.execute(
        """
        SELECT t.slug
        FROM topics t
        WHERE NOT EXISTS (
          SELECT 1
          FROM page_topics pt
          JOIN pages p ON p.slug = pt.page_slug
          WHERE pt.topic_slug = t.slug
        )
        ORDER BY t.slug
        """
    ).fetchall()
    return tuple(EmptyTopic(slug=row["slug"]) for row in rows)


def empty_pages(connection: SQLiteConnection) -> tuple[EmptyPage, ...]:
    rows = connection.execute(
        """
        SELECT slug, body
        FROM pages
        ORDER BY slug
        """
    ).fetchall()
    return tuple(
        EmptyPage(slug=row["slug"])
        for row in rows
        if not meaningful_body_text(row["body"])
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


def meaningful_body_text(body: str) -> str:
    lines = []
    for line in body.splitlines():
        if re.match(r"^\s*#+\s+", line):
            continue
        lines.append(line.strip())
    return "\n".join(lines).strip()

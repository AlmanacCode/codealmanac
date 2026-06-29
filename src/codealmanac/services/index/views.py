import re
from pathlib import Path

from codealmanac.core.slug import to_kebab_case
from codealmanac.database import SQLiteConnection, SQLiteRow
from codealmanac.services.index.models import (
    BrokenCrossWikiLink,
    BrokenPageLink,
    CrossWikiReference,
    DeadFileReference,
    EmptyPage,
    EmptyTopic,
    HealthReport,
    IndexCounts,
    OrphanPage,
    PageFileReference,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.index.requests import SearchIndexRequest
from codealmanac.services.wiki.paths import (
    escape_glob_meta,
    looks_like_dir,
    normalize_reference_path,
    parent_folder_prefixes,
)


def search_pages(
    connection: SQLiteConnection,
    request: SearchIndexRequest,
) -> tuple[SearchPageResult, ...]:
    rows = connection.execute(*search_sql(request)).fetchall()
    results = [search_result_from_row(connection, row) for row in rows]
    if request.limit is not None:
        return tuple(results[: request.limit])
    return tuple(results)


def index_counts(connection: SQLiteConnection) -> IndexCounts:
    page_count = connection.execute("SELECT COUNT(*) FROM pages").fetchone()[0]
    topic_count = connection.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    return IndexCounts(pages=page_count, topics=topic_count)


def get_page_view(connection: SQLiteConnection, slug: str) -> PageView | None:
    row = connection.execute(
        """
        SELECT slug, title, summary, file_path, updated_at, archived_at,
               superseded_by, body
        FROM pages
        WHERE slug = ?
        """,
        (slug,),
    ).fetchone()
    if row is None:
        return None
    return page_view_from_row(connection, row)


def list_topic_summaries(connection: SQLiteConnection) -> tuple[TopicSummary, ...]:
    rows = connection.execute(
        """
        SELECT t.slug, t.title, t.description,
               COUNT(p.slug) AS page_count
        FROM topics t
        LEFT JOIN page_topics pt ON pt.topic_slug = t.slug
        LEFT JOIN pages p ON p.slug = pt.page_slug AND p.archived_at IS NULL
        GROUP BY t.slug, t.title, t.description
        ORDER BY t.slug
        """
    ).fetchall()
    return tuple(
        TopicSummary(
            slug=row["slug"],
            title=row["title"],
            description=row["description"],
            page_count=row["page_count"],
        )
        for row in rows
    )


def get_topic_detail(
    connection: SQLiteConnection,
    slug: str,
    include_descendants: bool,
) -> TopicDetail | None:
    row = connection.execute(
        "SELECT slug, title, description FROM topics WHERE slug = ?",
        (slug,),
    ).fetchone()
    if row is None:
        return None
    topic_slugs = (
        topic_descendants(connection, slug) if include_descendants else (slug,)
    )
    return TopicDetail(
        slug=row["slug"],
        title=row["title"],
        description=row["description"],
        parents=topic_parents(connection, slug),
        children=topic_children(connection, slug),
        pages=pages_for_topics(connection, topic_slugs),
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
    )


def search_sql(request: SearchIndexRequest) -> tuple[str, tuple[object, ...]]:
    where_clauses: list[str] = []
    params: list[object] = []
    if request.archived:
        where_clauses.append("p.archived_at IS NOT NULL")
    elif not request.include_archive:
        where_clauses.append("p.archived_at IS NULL")

    for topic in request.topics:
        topic_slug = to_kebab_case(topic)
        if topic_slug:
            where_clauses.append(
                """
                EXISTS (
                  SELECT 1 FROM page_topics pt
                  WHERE pt.page_slug = p.slug AND pt.topic_slug = ?
                )
                """
            )
            params.append(topic_slug)

    if request.mentions is not None and request.mentions.strip():
        append_file_mention_clause(where_clauses, params, request.mentions)

    query = (request.query or "").strip()
    if query:
        where_clauses.insert(0, "fts_pages MATCH ?")
        params.insert(0, build_fts_query(query))
        return (
            f"""
            SELECT p.slug, p.title, p.summary, p.updated_at, p.archived_at,
                   p.superseded_by
            FROM pages p
            JOIN fts_pages f ON f.slug = p.slug
            WHERE {" AND ".join(where_clauses)}
            ORDER BY rank, p.updated_at DESC, p.slug ASC
            """,
            tuple(params),
        )

    where_sql = (
        f"WHERE {' AND '.join(where_clauses)}" if len(where_clauses) > 0 else ""
    )
    return (
        f"""
        SELECT p.slug, p.title, p.summary, p.updated_at, p.archived_at,
               p.superseded_by
        FROM pages p
        {where_sql}
        ORDER BY p.updated_at DESC, p.slug ASC
        """,
        tuple(params),
    )


def append_file_mention_clause(
    where_clauses: list[str],
    params: list[object],
    raw_path: str,
) -> None:
    is_dir = looks_like_dir(raw_path)
    normalized = normalize_reference_path(raw_path, is_dir)
    if is_dir:
        where_clauses.append(
            """
            EXISTS (
              SELECT 1 FROM file_refs r
              WHERE r.page_slug = p.slug
                AND (r.path = ? OR r.path GLOB ?)
            )
            """
        )
        params.extend([normalized, f"{escape_glob_meta(normalized)}*"])
        return

    parent_folders = parent_folder_prefixes(normalized)
    if not parent_folders:
        where_clauses.append(
            """
            EXISTS (
              SELECT 1 FROM file_refs r
              WHERE r.page_slug = p.slug AND r.path = ?
            )
            """
        )
        params.append(normalized)
        return

    placeholders = ", ".join("?" for _ in parent_folders)
    where_clauses.append(
        f"""
        EXISTS (
          SELECT 1 FROM file_refs r
          WHERE r.page_slug = p.slug
            AND (
              r.path = ?
              OR (r.is_dir = 1 AND r.path IN ({placeholders}))
            )
        )
        """
    )
    params.extend([normalized, *parent_folders])


def build_fts_query(raw: str) -> str:
    tokens = re.split(r"[^a-zA-Z0-9]+", raw.casefold())
    clean = [token for token in tokens if token]
    if not clean:
        return '""'
    return " AND ".join(f"{token}*" for token in clean)


def search_result_from_row(
    connection: SQLiteConnection,
    row: SQLiteRow,
) -> SearchPageResult:
    return SearchPageResult(
        slug=row["slug"],
        title=row["title"],
        summary=row["summary"],
        updated_at=row["updated_at"],
        archived_at=row["archived_at"],
        superseded_by=row["superseded_by"],
        topics=topics_for_page(connection, row["slug"]),
    )


def page_view_from_row(connection: SQLiteConnection, row: SQLiteRow) -> PageView:
    slug = row["slug"]
    return PageView(
        slug=slug,
        title=row["title"],
        summary=row["summary"],
        file_path=Path(row["file_path"]),
        updated_at=row["updated_at"],
        archived_at=row["archived_at"],
        superseded_by=row["superseded_by"],
        topics=topics_for_page(connection, slug),
        file_refs=file_refs_for_page(connection, slug),
        wikilinks_out=wikilinks_out_for_page(connection, slug),
        wikilinks_in=wikilinks_in_for_page(connection, slug),
        cross_wiki_links=cross_wiki_for_page(connection, slug),
        body=row["body"],
    )


def topics_for_page(connection: SQLiteConnection, slug: str) -> tuple[str, ...]:
    rows = connection.execute(
        "SELECT topic_slug FROM page_topics WHERE page_slug = ? ORDER BY topic_slug",
        (slug,),
    ).fetchall()
    return tuple(row["topic_slug"] for row in rows)


def file_refs_for_page(
    connection: SQLiteConnection,
    slug: str,
) -> tuple[PageFileReference, ...]:
    rows = connection.execute(
        """
        SELECT original_path, is_dir
        FROM file_refs
        WHERE page_slug = ?
        ORDER BY original_path
        """,
        (slug,),
    ).fetchall()
    return tuple(
        PageFileReference(path=row["original_path"], is_dir=bool(row["is_dir"]))
        for row in rows
    )


def wikilinks_out_for_page(
    connection: SQLiteConnection,
    slug: str,
) -> tuple[str, ...]:
    rows = connection.execute(
        "SELECT target_slug FROM wikilinks WHERE source_slug = ? ORDER BY target_slug",
        (slug,),
    ).fetchall()
    return tuple(row["target_slug"] for row in rows)


def wikilinks_in_for_page(connection: SQLiteConnection, slug: str) -> tuple[str, ...]:
    rows = connection.execute(
        "SELECT source_slug FROM wikilinks WHERE target_slug = ? ORDER BY source_slug",
        (slug,),
    ).fetchall()
    return tuple(row["source_slug"] for row in rows)


def cross_wiki_for_page(
    connection: SQLiteConnection,
    slug: str,
) -> tuple[CrossWikiReference, ...]:
    rows = connection.execute(
        """
        SELECT target_wiki, target_slug
        FROM cross_wiki_links
        WHERE source_slug = ?
        ORDER BY target_wiki, target_slug
        """,
        (slug,),
    ).fetchall()
    return tuple(
        CrossWikiReference(wiki=row["target_wiki"], target=row["target_slug"])
        for row in rows
    )


def topic_descendants(connection: SQLiteConnection, slug: str) -> tuple[str, ...]:
    rows = connection.execute(
        """
        WITH RECURSIVE descendants(slug, depth) AS (
          VALUES (?, 0)
          UNION
          SELECT tp.child_slug, descendants.depth + 1
          FROM topic_parents tp
          JOIN descendants ON tp.parent_slug = descendants.slug
          WHERE descendants.depth < 32
        )
        SELECT slug FROM descendants ORDER BY slug
        """,
        (slug,),
    ).fetchall()
    return tuple(row["slug"] for row in rows)


def pages_for_topics(
    connection: SQLiteConnection,
    topic_slugs: tuple[str, ...],
) -> tuple[str, ...]:
    if len(topic_slugs) == 0:
        return ()
    placeholders = ", ".join("?" for _ in topic_slugs)
    rows = connection.execute(
        f"""
        SELECT DISTINCT p.slug
        FROM pages p
        JOIN page_topics pt ON pt.page_slug = p.slug
        WHERE p.archived_at IS NULL
          AND pt.topic_slug IN ({placeholders})
        ORDER BY p.slug
        """,
        topic_slugs,
    ).fetchall()
    return tuple(row["slug"] for row in rows)


def topic_parents(connection: SQLiteConnection, slug: str) -> tuple[str, ...]:
    rows = connection.execute(
        """
        SELECT parent_slug
        FROM topic_parents
        WHERE child_slug = ?
        ORDER BY parent_slug
        """,
        (slug,),
    ).fetchall()
    return tuple(row["parent_slug"] for row in rows)


def topic_children(connection: SQLiteConnection, slug: str) -> tuple[str, ...]:
    rows = connection.execute(
        """
        SELECT child_slug
        FROM topic_parents
        WHERE parent_slug = ?
        ORDER BY child_slug
        """,
        (slug,),
    ).fetchall()
    return tuple(row["child_slug"] for row in rows)


def orphan_pages(connection: SQLiteConnection) -> tuple[OrphanPage, ...]:
    rows = connection.execute(
        """
        SELECT p.slug
        FROM pages p
        WHERE p.archived_at IS NULL
          AND NOT EXISTS (
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
        WHERE p.archived_at IS NULL
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
        WHERE source.archived_at IS NULL
          AND target.slug IS NULL
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
        WHERE source.archived_at IS NULL
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
          WHERE pt.topic_slug = t.slug AND p.archived_at IS NULL
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
        WHERE archived_at IS NULL
        ORDER BY slug
        """
    ).fetchall()
    return tuple(
        EmptyPage(slug=row["slug"])
        for row in rows
        if not meaningful_body_text(row["body"])
    )


def meaningful_body_text(body: str) -> str:
    lines = []
    for line in body.splitlines():
        if re.match(r"^\s*#+\s+", line):
            continue
        lines.append(line.strip())
    return "\n".join(lines).strip()

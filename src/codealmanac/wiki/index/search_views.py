import re

from codealmanac.core.slug import to_kebab_case
from codealmanac.database import SQLiteConnection, SQLiteRow
from codealmanac.wiki.index.models import SearchPageResult
from codealmanac.wiki.index.page_views import topics_for_page
from codealmanac.wiki.index.requests import SearchIndexRequest
from codealmanac.wiki.paths import (
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


def search_sql(request: SearchIndexRequest) -> tuple[str, tuple[object, ...]]:
    where_clauses: list[str] = []
    params: list[object] = []

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
            SELECT p.slug, p.title, p.summary, p.updated_at
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
        SELECT p.slug, p.title, p.summary, p.updated_at
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
        topics=topics_for_page(connection, row["slug"]),
    )

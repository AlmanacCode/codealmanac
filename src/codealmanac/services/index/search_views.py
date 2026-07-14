from pathlib import Path

from codealmanac.core.slug import to_kebab_case
from codealmanac.database import SQLiteConnection, SQLiteRow
from codealmanac.services.index.models import SearchPageResult
from codealmanac.services.index.page_views import topics_for_page
from codealmanac.services.index.query import analyze_search_query
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
    return tuple(search_result_from_row(connection, row) for row in rows)


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

    query = analyze_search_query(request.query or "")
    if query is not None:
        where_clauses.insert(0, "fts_sections MATCH ?")
        params.insert(0, query)
        limit_sql = ""
        if request.limit is not None:
            limit_sql = "LIMIT ?"
            params.append(request.limit)
        return (
            f"""
            WITH matched_sections AS MATERIALIZED (
              SELECT
                p.slug,
                p.title,
                p.summary,
                p.file_path,
                p.updated_at,
                ps.section_id,
                ps.heading_path AS matched_heading,
                NULLIF(
                  TRIM(snippet(fts_sections, 4, '', '', ' … ', 32)),
                  ''
                ) AS excerpt,
                bm25(fts_sections, 0.0, 0.0, 5.0, 3.0, 1.0) AS search_rank,
                ps.ordinal AS section_ordinal
              FROM pages p
              JOIN page_sections ps ON ps.page_slug = p.slug
              JOIN fts_sections
                ON fts_sections.page_slug = ps.page_slug
               AND fts_sections.section_id = ps.section_id
              WHERE {" AND ".join(where_clauses)}
            ),
            ranked_sections AS (
              SELECT
                *,
                ROW_NUMBER() OVER (
                  PARTITION BY slug
                  ORDER BY search_rank ASC, section_ordinal ASC, section_id ASC
                ) AS page_section_rank
              FROM matched_sections
            )
            SELECT
              slug,
              title,
              summary,
              file_path,
              updated_at,
              matched_heading,
              excerpt
            FROM ranked_sections
            WHERE page_section_rank = 1
            ORDER BY
              search_rank ASC,
              updated_at DESC,
              slug ASC
            {limit_sql}
            """,
            tuple(params),
        )

    where_sql = (
        f"WHERE {' AND '.join(where_clauses)}" if len(where_clauses) > 0 else ""
    )
    limit_sql = ""
    if request.limit is not None:
        limit_sql = "LIMIT ?"
        params.append(request.limit)
    return (
        f"""
        SELECT
          p.slug,
          p.title,
          p.summary,
          p.file_path,
          p.updated_at,
          NULL AS matched_heading,
          NULL AS excerpt
        FROM pages p
        {where_sql}
        ORDER BY p.updated_at DESC, p.slug ASC
        {limit_sql}
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


def search_result_from_row(
    connection: SQLiteConnection,
    row: SQLiteRow,
) -> SearchPageResult:
    return SearchPageResult(
        slug=row["slug"],
        title=row["title"],
        summary=row["summary"],
        file_path=Path(row["file_path"]),
        updated_at=row["updated_at"],
        topics=topics_for_page(connection, row["slug"]),
        matched_heading=row["matched_heading"],
        excerpt=row["excerpt"],
    )

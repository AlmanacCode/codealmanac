from pathlib import Path

from codealmanac.database import SQLiteConnection, SQLiteRow
from codealmanac.services.index.models import (
    CrossWikiReference,
    PageFileReference,
    PageSourceReference,
    PageView,
)
from codealmanac.services.wiki.models import PageSourceType


def get_page_view(connection: SQLiteConnection, slug: str) -> PageView | None:
    row = connection.execute(
        """
        SELECT slug, title, summary, file_path, updated_at, body
        FROM pages
        WHERE slug = ?
        """,
        (slug,),
    ).fetchone()
    if row is None:
        return None
    return page_view_from_row(connection, row)


def page_view_from_row(connection: SQLiteConnection, row: SQLiteRow) -> PageView:
    slug = row["slug"]
    return PageView(
        slug=slug,
        title=row["title"],
        summary=row["summary"],
        file_path=Path(row["file_path"]),
        updated_at=row["updated_at"],
        topics=topics_for_page(connection, slug),
        sources=page_sources_for_page(connection, slug),
        file_refs=file_refs_for_page(connection, slug),
        page_links_out=page_links_out_for_page(connection, slug),
        page_links_in=page_links_in_for_page(connection, slug),
        cross_wiki_links=cross_wiki_for_page(connection, slug),
        body=row["body"],
    )


def page_sources_for_page(
    connection: SQLiteConnection,
    slug: str,
) -> tuple[PageSourceReference, ...]:
    rows = connection.execute(
        """
        SELECT source_id, source_type, target, title, retrieved_at, note
        FROM page_sources
        WHERE page_slug = ?
        ORDER BY source_order
        """,
        (slug,),
    ).fetchall()
    return tuple(
        PageSourceReference(
            source_id=row["source_id"],
            source_type=PageSourceType(row["source_type"]),
            target=row["target"],
            title=row["title"],
            retrieved_at=row["retrieved_at"],
            note=row["note"],
        )
        for row in rows
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


def page_links_out_for_page(
    connection: SQLiteConnection,
    slug: str,
) -> tuple[str, ...]:
    rows = connection.execute(
        "SELECT target_slug FROM page_links WHERE source_slug = ? ORDER BY target_slug",
        (slug,),
    ).fetchall()
    return tuple(row["target_slug"] for row in rows)


def page_links_in_for_page(connection: SQLiteConnection, slug: str) -> tuple[str, ...]:
    rows = connection.execute(
        "SELECT source_slug FROM page_links WHERE target_slug = ? ORDER BY source_slug",
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

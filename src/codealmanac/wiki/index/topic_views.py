from codealmanac.database import SQLiteConnection
from codealmanac.wiki.index.models import TopicDetail, TopicSummary


def list_topic_summaries(connection: SQLiteConnection) -> tuple[TopicSummary, ...]:
    rows = connection.execute(
        """
        SELECT t.slug, t.title, t.description,
               COUNT(p.slug) AS page_count
        FROM topics t
        LEFT JOIN page_topics pt ON pt.topic_slug = t.slug
        LEFT JOIN pages p ON p.slug = pt.page_slug
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
        WHERE pt.topic_slug IN ({placeholders})
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

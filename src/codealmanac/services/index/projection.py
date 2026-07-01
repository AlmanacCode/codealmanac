from pydantic import ValidationError

from codealmanac.database import SQLiteConnection
from codealmanac.services.index.models import IndexSourceSignature
from codealmanac.services.index.sources import LoadedIndexSources
from codealmanac.services.wiki.models import PageDocument
from codealmanac.services.wiki.topics import TopicDefinition, title_for_slug

SOURCE_SIGNATURE_KEY = "source_signature"


def stored_signature(connection: SQLiteConnection) -> IndexSourceSignature | None:
    row = connection.execute(
        "SELECT value FROM index_metadata WHERE key = ?",
        (SOURCE_SIGNATURE_KEY,),
    ).fetchone()
    if row is None:
        return None
    try:
        return IndexSourceSignature.model_validate_json(row["value"])
    except (ValidationError, ValueError):
        return None


def replace_documents(
    connection: SQLiteConnection,
    sources: LoadedIndexSources,
) -> None:
    with connection:
        connection.execute("DELETE FROM fts_pages")
        connection.execute("DELETE FROM pages")
        connection.execute("DELETE FROM topic_parents")
        connection.execute("DELETE FROM topics")
        for document in sources.documents:
            insert_document(connection, document)
        for topic in sources.topics:
            insert_topic_definition(connection, topic)
        connection.execute(
            """
            INSERT INTO index_metadata (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (
                SOURCE_SIGNATURE_KEY,
                sources.signature.model_dump_json(),
            ),
        )


def insert_document(connection: SQLiteConnection, document: PageDocument) -> None:
    connection.execute(
        """
        INSERT INTO pages (
          slug, title, summary, file_path, content_hash, updated_at, body
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            document.slug,
            document.title,
            document.summary,
            str(document.file_path),
            document.content_hash,
            document.updated_at,
            document.body,
        ),
    )
    connection.execute(
        "INSERT INTO fts_pages (slug, title, content) VALUES (?, ?, ?)",
        (document.slug, document.title, document.body),
    )
    for topic in document.topics:
        if not topic:
            continue
        connection.execute(
            "INSERT OR IGNORE INTO topics (slug, title) VALUES (?, ?)",
            (topic, title_for_slug(topic)),
        )
        connection.execute(
            "INSERT OR IGNORE INTO page_topics (page_slug, topic_slug) VALUES (?, ?)",
            (document.slug, topic),
        )
    for ref in document.file_refs:
        connection.execute(
            """
            INSERT OR IGNORE INTO file_refs
              (page_slug, path, original_path, is_dir)
            VALUES (?, ?, ?, ?)
            """,
            (document.slug, ref.path, ref.original_path, int(ref.is_dir)),
        )
    for source_order, source in enumerate(document.sources):
        connection.execute(
            """
            INSERT INTO page_sources
              (
                page_slug, source_order, source_id, source_type, target, title,
                retrieved_at, note
              )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document.slug,
                source_order,
                source.source_id,
                source.source_type.value,
                source.target,
                source.title,
                source.retrieved_at,
                source.note,
            ),
        )
    for target in document.page_links:
        connection.execute(
            "INSERT OR IGNORE INTO wikilinks (source_slug, target_slug) VALUES (?, ?)",
            (document.slug, target),
        )
    for wiki, target in document.cross_wiki_links:
        connection.execute(
            """
            INSERT OR IGNORE INTO cross_wiki_links
              (source_slug, target_wiki, target_slug)
            VALUES (?, ?, ?)
            """,
            (document.slug, wiki, target),
        )


def insert_topic_definition(
    connection: SQLiteConnection,
    topic: TopicDefinition,
) -> None:
    connection.execute(
        """
        INSERT INTO topics (slug, title, description)
        VALUES (?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          description = excluded.description
        """,
        (topic.slug, topic.title or title_for_slug(topic.slug), topic.description),
    )
    for parent in topic.parents:
        connection.execute(
            "INSERT OR IGNORE INTO topics (slug, title) VALUES (?, ?)",
            (parent, title_for_slug(parent)),
        )
        connection.execute(
            """
            INSERT OR IGNORE INTO topic_parents (child_slug, parent_slug)
            VALUES (?, ?)
            """,
            (topic.slug, parent),
        )

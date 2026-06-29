from hashlib import sha256
from pathlib import Path

from pydantic import ValidationError

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.database import (
    SQLiteConnection,
    SQLiteMigration,
    apply_migrations,
    connect_sqlite,
)
from codealmanac.services.index.models import (
    HealthReport,
    IndexCounts,
    IndexedPageFingerprint,
    IndexRefreshResult,
    IndexSourceSignature,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.index.requests import SearchIndexRequest
from codealmanac.services.index.views import (
    build_health_report,
    get_page_view,
    get_topic_detail,
    index_counts,
    list_topic_summaries,
    search_pages,
)
from codealmanac.services.wiki.documents import load_page_document
from codealmanac.services.wiki.models import PageDocument
from codealmanac.services.wiki.topics import TopicDefinition, load_topics_yaml

SCHEMA_VERSION = 20260630

SCHEMA_DDL = """
CREATE TABLE IF NOT EXISTS pages (
  slug          TEXT PRIMARY KEY,
  title         TEXT,
  summary       TEXT,
  file_path     TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  updated_at    INTEGER NOT NULL,
  archived_at   INTEGER,
  superseded_by TEXT,
  body          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  slug        TEXT PRIMARY KEY,
  title       TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS page_topics (
  page_slug  TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  topic_slug TEXT NOT NULL,
  PRIMARY KEY (page_slug, topic_slug)
);

CREATE TABLE IF NOT EXISTS topic_parents (
  child_slug  TEXT NOT NULL,
  parent_slug TEXT NOT NULL,
  PRIMARY KEY (child_slug, parent_slug),
  CHECK (child_slug != parent_slug)
);

CREATE TABLE IF NOT EXISTS file_refs (
  page_slug     TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  path          TEXT NOT NULL,
  original_path TEXT NOT NULL,
  is_dir        INTEGER NOT NULL,
  PRIMARY KEY (page_slug, path)
);
CREATE INDEX IF NOT EXISTS idx_file_refs_path ON file_refs(path);

CREATE TABLE IF NOT EXISTS wikilinks (
  source_slug TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  target_slug TEXT NOT NULL,
  PRIMARY KEY (source_slug, target_slug)
);

CREATE TABLE IF NOT EXISTS cross_wiki_links (
  source_slug TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  target_wiki TEXT NOT NULL,
  target_slug TEXT NOT NULL,
  PRIMARY KEY (source_slug, target_wiki, target_slug)
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_pages USING fts5(slug, title, content);

CREATE TABLE IF NOT EXISTS index_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""

DROP_DERIVED_INDEX_DDL = """
DROP TABLE IF EXISTS cross_wiki_links;
DROP TABLE IF EXISTS wikilinks;
DROP TABLE IF EXISTS file_refs;
DROP TABLE IF EXISTS page_topics;
DROP TABLE IF EXISTS topic_parents;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS fts_pages;
DROP TABLE IF EXISTS index_metadata;
"""

INDEX_MIGRATIONS = (
    SQLiteMigration(
        version=SCHEMA_VERSION,
        sql=f"{DROP_DERIVED_INDEX_DDL}\n{SCHEMA_DDL}",
    ),
)

SOURCE_SIGNATURE_KEY = "source_signature"


class IndexStore:
    def refresh(self, almanac_path: Path) -> IndexRefreshResult:
        sources = load_index_sources(almanac_path)
        db_path = index_db_path(almanac_path)
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

    def rebuild(self, almanac_path: Path) -> IndexRefreshResult:
        sources = load_index_sources(almanac_path)
        db_path = index_db_path(almanac_path)
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
        request: SearchIndexRequest,
    ) -> tuple[SearchPageResult, ...]:
        with connect_index(index_db_path(almanac_path)) as connection:
            return search_pages(connection, request)

    def counts(self, almanac_path: Path) -> IndexCounts:
        with connect_index(index_db_path(almanac_path)) as connection:
            return index_counts(connection)

    def get_page(self, almanac_path: Path, slug: str) -> PageView | None:
        with connect_index(index_db_path(almanac_path)) as connection:
            return get_page_view(connection, slug)

    def list_topics(self, almanac_path: Path) -> tuple[TopicSummary, ...]:
        with connect_index(index_db_path(almanac_path)) as connection:
            return list_topic_summaries(connection)

    def get_topic(
        self,
        almanac_path: Path,
        slug: str,
        include_descendants: bool,
    ) -> TopicDetail | None:
        with connect_index(index_db_path(almanac_path)) as connection:
            return get_topic_detail(connection, slug, include_descendants)

    def health_report(
        self,
        almanac_path: Path,
        repo_root: Path,
        registered_wikis: set[str],
    ) -> HealthReport:
        with connect_index(index_db_path(almanac_path)) as connection:
            return build_health_report(connection, repo_root, registered_wikis)


class LoadedIndexSources(CodeAlmanacModel):
    documents: tuple[PageDocument, ...]
    topics: tuple[TopicDefinition, ...]
    files_seen: int
    files_skipped: int
    signature: IndexSourceSignature


def index_db_path(almanac_path: Path) -> Path:
    return almanac_path / "index.db"


def connect_index(path: Path) -> SQLiteConnection:
    connection = connect_sqlite(path)
    apply_migrations(connection, INDEX_MIGRATIONS)
    return connection


def load_documents(pages_path: Path) -> tuple[list[PageDocument], int, int]:
    if not pages_path.is_dir():
        return [], 0, 0
    documents: list[PageDocument] = []
    seen_slugs: set[str] = set()
    files = sorted(pages_path.rglob("*.md"))
    files_skipped = 0
    for page_path in files:
        document = load_page_document(page_path, pages_path)
        if document is None or document.slug in seen_slugs:
            files_skipped += 1
            continue
        seen_slugs.add(document.slug)
        documents.append(document)
    return documents, len(files), files_skipped


def load_index_sources(almanac_path: Path) -> LoadedIndexSources:
    documents, files_seen, files_skipped = load_documents(almanac_path / "pages")
    topics = load_topics_yaml(almanac_path)
    document_tuple = tuple(documents)
    signature = IndexSourceSignature(
        pages=tuple(
            IndexedPageFingerprint(
                slug=document.slug,
                relative_path=document.relative_path,
                content_hash=document.content_hash,
            )
            for document in document_tuple
        ),
        topics_hash=file_hash(almanac_path / "topics.yaml"),
        files_seen=files_seen,
        files_skipped=files_skipped,
    )
    return LoadedIndexSources(
        documents=document_tuple,
        topics=topics,
        files_seen=files_seen,
        files_skipped=files_skipped,
        signature=signature,
    )


def file_hash(path: Path) -> str:
    if not path.is_file():
        return sha256(b"").hexdigest()
    try:
        return sha256(path.read_bytes()).hexdigest()
    except OSError:
        return sha256(b"").hexdigest()


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
          slug, title, summary, file_path, content_hash, updated_at,
          archived_at, superseded_by, body
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            document.slug,
            document.title,
            document.summary,
            str(document.file_path),
            document.content_hash,
            document.updated_at,
            document.archived_at,
            document.superseded_by,
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


def title_for_slug(slug: str) -> str:
    return " ".join(word.capitalize() for word in slug.split("-") if word)

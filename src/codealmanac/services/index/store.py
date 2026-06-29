import re
from hashlib import sha256
from pathlib import Path

from pydantic import ValidationError

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.slug import to_kebab_case
from codealmanac.database import (
    SQLiteConnection,
    SQLiteMigration,
    SQLiteRow,
    apply_migrations,
    connect_sqlite,
)
from codealmanac.services.index.models import (
    BrokenCrossWikiLink,
    BrokenPageLink,
    CrossWikiReference,
    DeadFileReference,
    EmptyPage,
    EmptyTopic,
    HealthReport,
    IndexCounts,
    IndexedPageFingerprint,
    IndexRefreshResult,
    IndexSourceSignature,
    OrphanPage,
    PageFileReference,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.index.requests import SearchIndexRequest
from codealmanac.services.wiki.documents import load_page_document
from codealmanac.services.wiki.models import PageDocument
from codealmanac.services.wiki.paths import (
    escape_glob_meta,
    looks_like_dir,
    normalize_reference_path,
    parent_folder_prefixes,
)
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
            rows = connection.execute(
                *search_sql(request),
            ).fetchall()
            results = [search_result_from_row(connection, row) for row in rows]
        if request.limit is not None:
            return tuple(results[: request.limit])
        return tuple(results)

    def counts(self, almanac_path: Path) -> IndexCounts:
        with connect_index(index_db_path(almanac_path)) as connection:
            page_count = connection.execute("SELECT COUNT(*) FROM pages").fetchone()[0]
            topic_count = connection.execute(
                "SELECT COUNT(*) FROM topics"
            ).fetchone()[0]
        return IndexCounts(pages=page_count, topics=topic_count)

    def get_page(self, almanac_path: Path, slug: str) -> PageView | None:
        with connect_index(index_db_path(almanac_path)) as connection:
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

    def list_topics(self, almanac_path: Path) -> tuple[TopicSummary, ...]:
        with connect_index(index_db_path(almanac_path)) as connection:
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

    def get_topic(
        self,
        almanac_path: Path,
        slug: str,
        include_descendants: bool,
    ) -> TopicDetail | None:
        with connect_index(index_db_path(almanac_path)) as connection:
            row = connection.execute(
                "SELECT slug, title, description FROM topics WHERE slug = ?",
                (slug,),
            ).fetchone()
            if row is None:
                return None
            topic_slugs = (
                topic_descendants(connection, slug)
                if include_descendants
                else (slug,)
            )
            pages = pages_for_topics(connection, topic_slugs)
            return TopicDetail(
                slug=row["slug"],
                title=row["title"],
                description=row["description"],
                parents=topic_parents(connection, slug),
                children=topic_children(connection, slug),
                pages=pages,
            )

    def health_report(
        self,
        almanac_path: Path,
        registered_wikis: set[str],
    ) -> HealthReport:
        repo_root = almanac_path.parent
        with connect_index(index_db_path(almanac_path)) as connection:
            return HealthReport(
                orphans=orphan_pages(connection),
                dead_refs=dead_file_refs(connection, repo_root),
                broken_links=broken_page_links(connection),
                broken_xwiki=broken_cross_wiki_links(connection, registered_wikis),
                empty_topics=empty_topics(connection),
                empty_pages=empty_pages(connection),
            )


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


def title_for_slug(slug: str) -> str:
    return " ".join(word.capitalize() for word in slug.split("-") if word)


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

from hashlib import sha256
from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.index.models import (
    IndexedPageFingerprint,
    IndexSourceSignature,
)
from codealmanac.services.wiki.documents import load_page_document
from codealmanac.services.wiki.models import PageDocument
from codealmanac.services.wiki.paths import iter_page_paths
from codealmanac.services.wiki.topics import TopicDefinition, load_topics_yaml


class PageRouteCollision(ValidationFailed):
    """Two page files claim the same wiki route."""


class LoadedIndexSources(CodeAlmanacModel):
    documents: tuple[PageDocument, ...]
    topics: tuple[TopicDefinition, ...]
    files_seen: int
    files_skipped: int
    signature: IndexSourceSignature


def load_index_sources(almanac_path: Path) -> LoadedIndexSources:
    documents, files_seen, files_skipped = load_documents(almanac_path)
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


def load_documents(almanac_path: Path) -> tuple[list[PageDocument], int, int]:
    if not almanac_path.is_dir():
        return [], 0, 0
    documents: list[PageDocument] = []
    seen_slugs: dict[str, Path] = {}
    files = tuple(iter_page_paths(almanac_path))
    files_skipped = 0
    for page_path in files:
        document = load_page_document(page_path, almanac_path)
        if document is None:
            files_skipped += 1
            continue
        if document.slug in seen_slugs:
            first = seen_slugs[document.slug]
            raise PageRouteCollision(
                "page route collision: "
                f"{document.slug} maps to both {first} and {page_path}"
            )
        seen_slugs[document.slug] = page_path
        documents.append(document)
    return documents, len(files), files_skipped


def file_hash(path: Path) -> str:
    if not path.is_file():
        return sha256(b"").hexdigest()
    try:
        return sha256(path.read_bytes()).hexdigest()
    except OSError as error:
        # An unreadable file must not hash like a missing one, or the index
        # would report itself fresh while the file's content stays unread.
        return sha256(f"unreadable:{error.__class__.__name__}".encode()).hexdigest()

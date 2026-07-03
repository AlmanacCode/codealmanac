from hashlib import sha256
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.wiki.documents import load_page_document
from codealmanac.wiki.index.models import (
    IndexedPageFingerprint,
    IndexSourceSignature,
)
from codealmanac.wiki.models import PageDocument
from codealmanac.wiki.topic_models import TopicDefinition
from codealmanac.wiki.topic_read import load_topics_yaml


class LoadedIndexSources(CodeAlmanacModel):
    documents: tuple[PageDocument, ...]
    topics: tuple[TopicDefinition, ...]
    files_seen: int
    files_skipped: int
    signature: IndexSourceSignature


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


def file_hash(path: Path) -> str:
    if not path.is_file():
        return sha256(b"").hexdigest()
    try:
        return sha256(path.read_bytes()).hexdigest()
    except OSError:
        return sha256(b"").hexdigest()

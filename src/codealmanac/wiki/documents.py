from hashlib import sha256
from pathlib import Path

from codealmanac.core.slug import to_kebab_case
from codealmanac.wiki.frontmatter import first_h1, parse_frontmatter
from codealmanac.wiki.models import (
    CrossWikiLink,
    FileLink,
    FileReference,
    FolderLink,
    PageDocument,
    PageLink,
    PageSource,
    PageSourceType,
)
from codealmanac.wiki.paths import (
    looks_like_dir,
    normalize_reference_path,
    normalize_reference_path_preserving_case,
)
from codealmanac.wiki.wikilinks import extract_wikilinks


def load_page_document(page_path: Path, pages_path: Path) -> PageDocument | None:
    raw = page_path.read_text(encoding="utf-8")
    frontmatter = parse_frontmatter(raw)
    relative_path = page_path.relative_to(pages_path).as_posix()
    slug_source = frontmatter.page_id or page_path.stem
    slug = to_kebab_case(slug_source)
    if not slug:
        return None

    title = frontmatter.title or first_h1(frontmatter.body) or page_path.stem
    file_refs = list(frontmatter_file_refs(frontmatter.files))
    file_refs.extend(source_file_refs(frontmatter.sources))
    page_links: list[str] = []
    cross_wiki_links: list[tuple[str, str]] = []

    for link in extract_wikilinks(frontmatter.body):
        if isinstance(link, PageLink):
            page_links.append(link.target)
        elif isinstance(link, FileLink | FolderLink):
            file_refs.append(link.ref)
        elif isinstance(link, CrossWikiLink):
            cross_wiki_links.append((link.wiki, link.target))

    return PageDocument(
        slug=slug,
        title=title,
        summary=frontmatter.summary,
        file_path=page_path,
        relative_path=relative_path,
        content_hash=sha256(raw.encode("utf-8")).hexdigest(),
        updated_at=int(page_path.stat().st_mtime),
        topics=tuple(to_kebab_case(topic) for topic in frontmatter.topics),
        sources=frontmatter.sources,
        file_refs=dedupe_file_refs(file_refs),
        page_links=tuple(sorted(set(page_links))),
        cross_wiki_links=tuple(sorted(set(cross_wiki_links))),
        body=frontmatter.body,
    )


def frontmatter_file_refs(files: tuple[str, ...]) -> tuple[FileReference, ...]:
    refs: list[FileReference] = []
    for raw in files:
        is_dir = looks_like_dir(raw)
        normalized = normalize_reference_path(raw, is_dir)
        original = normalize_reference_path_preserving_case(raw, is_dir)
        if normalized:
            refs.append(
                FileReference(
                    path=normalized,
                    original_path=original,
                    is_dir=is_dir,
                )
            )
    return tuple(refs)


def source_file_refs(sources: tuple[PageSource, ...]) -> tuple[FileReference, ...]:
    refs: list[FileReference] = []
    for source in sources:
        if source.source_type != PageSourceType.FILE or source.target is None:
            continue
        is_dir = looks_like_dir(source.target)
        normalized = normalize_reference_path(source.target, is_dir)
        original = normalize_reference_path_preserving_case(source.target, is_dir)
        if normalized:
            refs.append(
                FileReference(
                    path=normalized,
                    original_path=original,
                    is_dir=is_dir,
                )
            )
    return tuple(refs)


def dedupe_file_refs(refs: list[FileReference]) -> tuple[FileReference, ...]:
    unique: dict[tuple[str, bool], FileReference] = {}
    for ref in refs:
        unique[(ref.path, ref.is_dir)] = ref
    return tuple(sorted(unique.values(), key=lambda ref: (ref.path, ref.is_dir)))

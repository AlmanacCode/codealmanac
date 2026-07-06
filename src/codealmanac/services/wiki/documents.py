from hashlib import sha256
from pathlib import Path

from codealmanac.core.slug import to_kebab_case
from codealmanac.services.wiki.frontmatter import first_h1, parse_frontmatter
from codealmanac.services.wiki.links import extract_page_links
from codealmanac.services.wiki.models import (
    FileReference,
    PageDocument,
    PageSource,
    PageSourceType,
)
from codealmanac.services.wiki.paths import (
    looks_like_dir,
    normalize_reference_path,
    normalize_reference_path_preserving_case,
    page_id_for_path,
)


def load_page_document(page_path: Path, almanac_path: Path) -> PageDocument | None:
    raw = page_path.read_text(encoding="utf-8")
    frontmatter = parse_frontmatter(raw)
    relative_path = page_path.relative_to(almanac_path).as_posix()
    page_id = page_id_for_path(almanac_path, page_path)
    if not page_id:
        return None

    title = frontmatter.title or first_h1(frontmatter.body) or page_path.stem
    file_refs = list(source_file_refs(frontmatter.sources))
    page_links = extract_page_links(
        frontmatter.body,
        page_id,
        source_is_folder_landing=page_path.name == "README.md",
    )

    return PageDocument(
        slug=page_id,
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
        cross_wiki_links=(),
        body=frontmatter.body,
    )


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

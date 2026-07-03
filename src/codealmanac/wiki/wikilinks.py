import re

from codealmanac.core.slug import to_kebab_case
from codealmanac.wiki.models import (
    CrossWikiLink,
    FileLink,
    FileReference,
    FolderLink,
    PageLink,
    Wikilink,
    WikilinkKind,
)
from codealmanac.wiki.paths import (
    looks_like_dir,
    normalize_reference_path,
    normalize_reference_path_preserving_case,
)


def classify_wikilink(raw: str) -> Wikilink | None:
    target = raw.split("|", maxsplit=1)[0].strip()
    if not target:
        return None

    first_colon = target.find(":")
    first_slash = target.find("/")

    if first_colon != -1 and (first_slash == -1 or first_colon < first_slash):
        wiki = target[:first_colon].strip()
        slug = target[first_colon + 1 :].strip()
        if not wiki or not slug:
            return None
        return CrossWikiLink(kind=WikilinkKind.CROSS_WIKI, wiki=wiki, target=slug)

    if first_slash != -1:
        is_dir = looks_like_dir(target)
        normalized = normalize_reference_path(target, is_dir)
        original = normalize_reference_path_preserving_case(target, is_dir)
        if not normalized:
            return None
        ref = FileReference(path=normalized, original_path=original, is_dir=is_dir)
        if is_dir:
            return FolderLink(kind=WikilinkKind.FOLDER, ref=ref)
        return FileLink(kind=WikilinkKind.FILE, ref=ref)

    slug = to_kebab_case(target)
    if not slug:
        return None
    return PageLink(kind=WikilinkKind.PAGE, target=slug)


def extract_wikilinks(body: str) -> tuple[Wikilink, ...]:
    links: list[Wikilink] = []
    for match in re.finditer(r"\[\[([^\]\n]+)\]\]", body):
        link = classify_wikilink(match.group(1))
        if link is not None:
            links.append(link)
    return tuple(links)

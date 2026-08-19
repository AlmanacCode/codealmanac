from pathlib import Path

from codealmanac.services.wiki.frontmatter import parse_frontmatter
from codealmanac.services.wiki.links import extract_page_links, resolve_page_href
from codealmanac.services.wiki.paths import (
    escape_glob_meta,
    iter_page_paths,
    normalize_reference_path,
    page_id_for_path,
)


def test_page_iteration_excludes_repository_manuals(tmp_path):
    almanac_path = tmp_path / "almanac"
    manual_path = almanac_path / "manual"
    manual_path.mkdir(parents=True)
    page = almanac_path / "architecture/wiki.md"
    page.parent.mkdir()
    page.write_text("# Wiki\n", encoding="utf-8")
    (manual_path / "how-to-write.md").write_text("# Manual\n", encoding="utf-8")

    assert tuple(iter_page_paths(almanac_path)) == (page,)


def test_page_iteration_excludes_uppercase_markdown_suffixes(tmp_path):
    almanac_path = tmp_path / "almanac"
    almanac_path.mkdir(parents=True)
    page = almanac_path / "wiki.md"
    page.write_text("# Wiki\n", encoding="utf-8")
    (almanac_path / "NOTES.MD").write_text("# Notes\n", encoding="utf-8")
    (almanac_path / "Mixed.Md").write_text("# Mixed\n", encoding="utf-8")

    assert tuple(iter_page_paths(almanac_path)) == (page,)


def test_page_iteration_filters_case_insensitive_glob_matches(tmp_path, monkeypatch):
    # `rglob` only returns uppercase suffixes on a case-insensitive filesystem,
    # so on Linux the test above cannot reach the filter at all. Feeding the
    # match in directly pins the behaviour on every runner, and keeps
    # `iter_page_paths` and `page_id_for_path` provably in agreement.
    almanac_path = tmp_path / "almanac"
    almanac_path.mkdir(parents=True)
    page = almanac_path / "wiki.md"
    page.write_text("# Wiki\n", encoding="utf-8")
    upper = almanac_path / "NOTES.MD"
    upper.write_text("# Notes\n", encoding="utf-8")
    monkeypatch.setattr(Path, "rglob", lambda self, pattern: iter((page, upper)))

    iterated = tuple(iter_page_paths(almanac_path))

    assert iterated == (page,)
    for path in iterated:
        assert page_id_for_path(almanac_path, path)


def test_frontmatter_uses_pydantic_validated_shape():
    parsed = parse_frontmatter(
        """---
title: Auth Flow
summary: Login path.
topics:
  - Auth
sources:
  - id: auth-code
    type: file
    path: Src/Auth/
archived_at: 2026-01-02
superseded_by: old-auth
ignored: true
---
# Body
"""
    )

    assert parsed.title == "Auth Flow"
    assert parsed.summary == "Login path."
    assert parsed.topics == ("Auth",)
    assert parsed.sources[0].source_id == "auth-code"
    assert parsed.sources[0].target == "Src/Auth/"
    assert "files" not in parsed.model_dump()
    assert "archived_at" not in parsed.model_dump()
    assert "superseded_by" not in parsed.model_dump()
    assert parsed.body == "# Body"


def test_frontmatter_sources_accept_generic_target_fallback():
    parsed = parse_frontmatter(
        """---
title: Auth Flow
sources:
  - id: auth-code
    type: file
    target: src/auth/service.py
---
# Body
"""
    )

    assert len(parsed.sources) == 1
    assert parsed.sources[0].source_id == "auth-code"
    assert parsed.sources[0].source_type == "file"
    assert parsed.sources[0].target == "src/auth/service.py"


def test_frontmatter_sources_prefer_type_specific_target_fields():
    parsed = parse_frontmatter(
        """---
title: Provider
sources:
  - id: provider
    type: web
    url: https://example.com/current
    target: https://example.com/stale
---
# Body
"""
    )

    assert len(parsed.sources) == 1
    assert parsed.sources[0].target == "https://example.com/current"


def test_markdown_page_links_resolve_from_page_location():
    body = """See [Source Provenance](decisions/source-provenance).

Also see [Sibling](wiki-tree), [Parent](../decisions/local-first-python),
[External](https://example.com), [Anchor](#section), and [File](src/auth.py).

`[Code](code-link)` is not a page link.

```markdown
[Fence](fence-link)
```
"""

    assert extract_page_links(
        body,
        "architecture/indexing",
        source_is_folder_landing=False,
    ) == (
        "architecture/decisions/source-provenance",
        "architecture/wiki-tree",
        "decisions/local-first-python",
    )


def test_markdown_page_links_resolve_from_folder_landing_page():
    assert (
        resolve_page_href(
            "wiki-tree",
            "architecture",
            source_is_folder_landing=True,
        )
        == "architecture/wiki-tree"
    )
    assert (
        resolve_page_href(
            "architecture/viewer",
            "README",
            source_is_folder_landing=True,
        )
        == "architecture/viewer"
    )


def test_markdown_page_links_ignore_non_page_hrefs():
    assert (
        resolve_page_href(
            "/architecture/viewer",
            "architecture/indexing",
            source_is_folder_landing=False,
        )
        is None
    )
    assert (
        resolve_page_href(
            "src/auth/session.py",
            "architecture/indexing",
            source_is_folder_landing=False,
        )
        is None
    )


def test_reference_paths_normalize_and_escape_glob_metacharacters():
    normalized = normalize_reference_path("./Src/[id]/Page.tsx", is_dir=False)

    assert normalized == "src/[id]/page.tsx"
    assert escape_glob_meta(normalized) == "src/[[]id]/page.tsx"


def test_reference_paths_stay_repo_relative():
    assert normalize_reference_path("/Src/Auth.py", is_dir=False) == "src/auth.py"
    assert normalize_reference_path("../secrets.txt", is_dir=False) == ""

from codealmanac.services.wiki.frontmatter import parse_frontmatter
from codealmanac.services.wiki.links import extract_page_links, resolve_page_href
from codealmanac.services.wiki.paths import escape_glob_meta, normalize_reference_path


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

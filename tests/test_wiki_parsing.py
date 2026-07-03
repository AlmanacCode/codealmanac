from codealmanac.wiki.frontmatter import parse_frontmatter
from codealmanac.wiki.paths import escape_glob_meta, normalize_reference_path
from codealmanac.wiki.wikilinks import classify_wikilink


def test_frontmatter_uses_pydantic_validated_shape():
    parsed = parse_frontmatter(
        """---
title: Auth Flow
summary: Login path.
topics:
  - Auth
files:
  - Src/Auth/
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
    assert parsed.files == ("Src/Auth/",)
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


def test_wikilink_classification_preserves_existing_rules():
    assert classify_wikilink("openalmanac:supabase").kind == "xwiki"
    assert classify_wikilink("src/a:b.ts").kind == "file"
    assert classify_wikilink("src/auth/").kind == "folder"
    assert classify_wikilink("Auth Flow").kind == "page"


def test_reference_paths_normalize_and_escape_glob_metacharacters():
    normalized = normalize_reference_path("./Src/[id]/Page.tsx", is_dir=False)

    assert normalized == "src/[id]/page.tsx"
    assert escape_glob_meta(normalized) == "src/[[]id]/page.tsx"


def test_reference_paths_stay_repo_relative():
    assert normalize_reference_path("/Src/Auth.py", is_dir=False) == "src/auth.py"
    assert normalize_reference_path("../secrets.txt", is_dir=False) == ""

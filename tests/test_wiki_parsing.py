from codealmanac.services.wiki.frontmatter import parse_frontmatter
from codealmanac.services.wiki.paths import escape_glob_meta, normalize_reference_path
from codealmanac.services.wiki.wikilinks import classify_wikilink


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
ignored: true
---
# Body
"""
    )

    assert parsed.title == "Auth Flow"
    assert parsed.summary == "Login path."
    assert parsed.topics == ("Auth",)
    assert parsed.files == ("Src/Auth/",)
    assert parsed.archived_at is not None
    assert parsed.body == "# Body"


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

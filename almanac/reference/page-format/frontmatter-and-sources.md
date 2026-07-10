---
title: Frontmatter And Sources
topics: [reference, page-format, sources]
sources:
  - id: wiki_frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
    note: Supported frontmatter fields, source parsing, source target fields, and frontmatter body extraction.
  - id: wiki_models
    type: file
    path: src/codealmanac/services/wiki/models.py
    note: Page source, parsed frontmatter, file reference, and page document models.
  - id: wiki_documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
    note: Page document loading, topic normalization, source-to-file-ref conversion, and title fallback.
  - id: evidence_manual
    type: file
    path: src/codealmanac/manual/evidence.md
    note: Authoring manual for sources and inline citations.
  - id: health_sources
    type: file
    path: src/codealmanac/services/health/sources.py
    note: Validation of source frontmatter shape.
  - id: source_health
    type: file
    path: src/codealmanac/services/index/health_source_views.py
    note: Citation, unused source, missing citation, and duplicate source checks.
  - id: page-kinds
    type: wiki
    path: concepts/page-kinds
    note: Concept page for page-kind vocabulary and why kind is not current identity.
---

# Frontmatter And Sources

CodeAlmanac pages use YAML frontmatter for page metadata and structured evidence. The supported parsed fields are `title`, `summary`, `topics`, and `sources`; other frontmatter keys are ignored by the parser rather than becoming page model fields [@wiki_frontmatter]. Page identity still comes from the Markdown path, not from frontmatter.

[Future page kinds](../../concepts/page-kinds) explains the related product vocabulary for concept, architecture, guide, decision, and reference pages. That vocabulary is not a current frontmatter identity field; the parser only models the supported fields listed here [@wiki_frontmatter] [@page-kinds].

Sources are the evidence contract. A page lists named source entries in `sources:`, then cites non-obvious factual claims in the body with inline source markers [@evidence_manual]. This format is paired with [Markdown links and sources](../../decisions/markdown-links-and-sources): links navigate between wiki pages, while sources point to files, web pages, commits, PRs, issues, conversations, wiki pages, or manuals.

## Supported Frontmatter Fields

| Field | Shape | Behavior |
|---|---|---|
| `title` | Non-empty string | Trimmed and used as the page title. If absent, the loader falls back to the first H1, then the filename stem [@wiki_frontmatter] [@wiki_documents]. |
| `summary` | Non-empty string | Trimmed and stored as the page summary [@wiki_frontmatter]. |
| `topics` | List of strings | Non-empty items are trimmed, then normalized to kebab-case during page loading [@wiki_frontmatter] [@wiki_documents]. |
| `sources` | List of source objects | Parsed into typed `PageSource` records [@wiki_frontmatter] [@wiki_models]. |

If the frontmatter cannot be parsed, `parse_frontmatter()` returns the raw document body without metadata [@wiki_frontmatter]. Validation is stricter: malformed frontmatter or malformed source lists are reported as validation issues by the health source checks [@health_sources].

## Source Entry Shape

Each source entry must include an `id`, a supported `type`, and a target field [@health_sources]. The parsed model stores `source_id`, `source_type`, `target`, optional `title`, optional `retrieved_at`, and optional `note` [@wiki_models].

Supported source types are:

| Type | Preferred target fields |
|---|---|
| `file` | `path` |
| `web` | `url` |
| `commit` | `commit`, `sha`, `ref` |
| `pr` | `pr`, `number`, `url` |
| `issue` | `issue`, `number`, `url` |
| `conversation` | `path`, `run_id`, `session_id` |
| `wiki` | `page`, `slug`, `path` |
| `manual` | `path`, `page`, `title` |

If none of the type-specific target fields are present, the parser accepts a generic `target` field [@wiki_frontmatter]. Type-specific fields take precedence over `target`, so a `web` source with both `url` and `target` uses `url` [@wiki_frontmatter].

## File Sources And File Refs

Only `type: file` sources become indexed file references [@wiki_documents]. The loader detects directory references by a trailing slash, normalizes the target path, preserves a normalized original-case path for display, and skips unsafe or empty normalized paths [@wiki_documents]. This powers file mention lookup without treating file paths as page links.

File evidence belongs in `sources:`. Do not put implementation paths into inline Markdown links just to record evidence; page links and file evidence have different roles in the index [@evidence_manual].

## Citations And Validation

Inline citations use bracketed source markers in the page body. The source health view extracts citation ids with a restricted id pattern and compares them to the page's indexed source ids [@source_health]. A citation with no matching source becomes `missing_source_citations`, a listed source that is not cited becomes `unused_sources`, and repeated source ids on one page become `duplicate_sources` [@source_health].

The evidence manual says citations should sit close to the factual claim they support, and that code should be cited for runtime behavior, tests for enforced contracts, and docs for stated intent [@evidence_manual]. The validation machinery does not judge source quality; it checks that authored source ids and citation markers line up.

For validation behavior around these issues, see [Health and validation](../../architecture/wiki/health-and-validation). For the surrounding concept, see [Source material](../../concepts/source-material).

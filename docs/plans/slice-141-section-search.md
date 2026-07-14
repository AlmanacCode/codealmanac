# Slice 141: section-level lexical search

**Status:** implementation plan
**Depends on:** `docs/plans/2026-07-14-section-search-design.md`

## Outcome

Replace whole-page strict-AND search with a rebuildable section projection and
recall-oriented SQLite FTS5/BM25 search. The user still searches for pages and
opens a page with `show`; each text-search result additionally carries the
heading and excerpt that explain why the page ranked.

## Scope

- Parse authored Markdown into deterministic heading-based sections with the
  existing `markdown-it-py` dependency.
- Persist section rows and an FTS5 index as derived state.
- Turn natural-language queries into escaped prefix terms joined with `OR`.
- Rank section matches with weighted SQLite `bm25()`, preferring page title,
  then heading, then body.
- Collapse multiple section matches to one page using the best section score
  and deterministic tie-breaking.
- Preserve topic and mention filters, no-query ordering, page identity,
  implicit refresh, and the `search -> show` interaction.
- Add match heading and excerpt to the typed search result and expose them
  consistently through terminal JSON and viewer DTOs. Human terminal output
  remains byte-for-byte compatible in this slice.

## Out of scope

- Embeddings, semantic or hybrid retrieval, query rewriting, fuzzy matching,
  an external search engine, user-controlled ranking weights, or iterative
  retrieval.
- Changing authored Markdown, page routes, topics, mentions, or `show`.
- Stop-word dictionaries or English-only stemming. Recall comes from OR
  eligibility; BM25 naturally pushes weak common-term matches down.

## Frozen search policy

### Section projection

`wiki.sections.project(body)` owns Markdown meaning. A heading opens a section
that extends until the next heading of any level. Its `heading_path` contains
the active heading ancestry. Text before the first heading is an introduction
section using the page title as its display heading. Empty heading sections are
kept because the heading itself is searchable and may name a concept.

Section order is source order. `section_id` is the zero-padded source ordinal;
it is deterministic for identical Markdown across rebuilds and unique within a
page. The stored body is the exact Markdown source slice after the opening
heading and before the next heading. FTS indexes the page slug, page title,
heading path, and section body; authored Markdown remains the source of truth.

### Query analysis

The analyzer extracts Unicode word tokens, case-folds them, preserves their
first-seen order, removes duplicates, quotes every token as FTS syntax data,
adds prefix matching, and joins terms with `OR`. No raw FTS operator reaches
SQLite. Punctuation-only queries behave as empty text queries so topic and
mention filters remain usable.

The first implementation deliberately has no stop-word list. A fixed English
list would discard valid identifiers and names, while OR matching already
prevents filler words from excluding the correct section. The benchmark and
real-repo probes will determine whether a later language-aware analyzer earns
its cost.

### Ranking and collapse

Use `bm25(fts_sections, 0.0, 5.0, 3.0, 1.0)` for slug, page title, heading,
and body. Slug is candidate material but has zero score weight because title
and heading are the intended authored relevance signals. Sort section matches
by ascending BM25 score, then page slug and section ordinal. A grouped query
retains the minimum score per page and its first section under that ordering.
Final pages sort by best score, newest page timestamp, then slug. `snippet()`
produces a bounded plain-text excerpt from the matched section body; if the
body has no snippet, the heading is the only match evidence.

## Ownership and file changes

- `services/wiki/sections.py`: typed `WikiSection` projection from Markdown.
- `services/index/schema.py`: versioned `page_sections` and `fts_sections`
  derived schema; retire `fts_pages`.
- `services/index/projection.py`: persist each document and its section rows.
- `services/index/query.py`: safe lexical query analysis.
- `services/index/search_views.py`: SQL filtering, weighted ranking, collapse,
  row conversion, and existing mention composition.
- `services/index/models.py`: additive `matched_heading` and `excerpt` fields.
- `services/viewer/models.py` and `services/viewer/projections.py`: carry the
  same optional evidence through the browser API.
- CLI rendering remains unchanged except JSON automatically gains the additive
  typed fields.

This follows the local repository rule that a store hides persistence detail
and the service layer remains the stable product entrypoint: "The service
layer will become the main way into our app"
(`docs/reference/cosmic-python/chapter_04_service_layer.md`).

## Test coverage

Write failing tests first for:

- deterministic heading paths, source slices, duplicate headings, preamble,
  code blocks containing `#`, setext headings, and heading-only sections;
- safe query escaping, prefix matching, duplicate terms, Unicode identifiers,
  and punctuation-only input;
- natural questions that strict AND previously rejected;
- title and heading weighting over body-only matches;
- multiple matching sections collapsing to one page with stable evidence;
- topic and mention filters composed with text search;
- identifiers, dates, paths, and exact error strings;
- stale-schema rebuild and deterministic repeated projection;
- service, JSON, viewer, and unchanged human terminal behavior.

Run targeted read-model/wiki/viewer/CLI tests during construction. Before the
implementation commit, run `uv run pytest` and `uv run ruff check .`. There is
no configured Pyright gate in `pyproject.toml`.

## Dogfood and performance

Search the real CodeAlmanac wiki with at least:

- `How does cancellation terminate a running agent?`
- `Where is path normalization handled?`
- exact identifiers and paths already used by agents.

Record result ordering and wall time. Build a temporary synthetic wiki large
enough to detect accidental per-result SQL or obviously nonlinear projection;
do not add benchmark machinery to the product repository.

## Review and commit gates

1. Commit this implementation plan.
2. Implement section projection and persistence with focused tests.
3. Implement query/ranking/result evidence with service and edge tests.
4. Run dogfood and full gates; commit the coherent implementation.
5. Review using `.claude/agents/review.md`, write
   `docs/plans/fixes-slice-141-review.md`, fix must/should findings, rerun full
   gates, and commit review fixes separately.


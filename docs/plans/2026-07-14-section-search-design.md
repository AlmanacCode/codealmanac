# Section-level search design

**Status:** accepted on 2026-07-14
**Scope:** product architecture; implementation receives a separate slice plan

## Decision

CodeAlmanac will replace whole-page strict-AND search with section-level SQLite
FTS5 and BM25 ranking. This becomes the default product search, not a hidden
benchmark-only variant.

The product will not add semantic retrieval in this change. The design keeps a
clean future path for hybrid lexical/semantic retrieval, but vector machinery is
not justified until measured failures show that relevant sections lack useful
lexical overlap.

## Why the current search changes

The current projection writes one FTS row per page containing the slug, title,
and entire body. The query builder splits every word, converts each word to a
prefix term, and joins all terms with `AND`. SQLite then ranks only the pages
that survive that filter using FTS5's default BM25 rank.

This means natural questions can return no results because filler words and
paraphrased verbs are required even when the page contains the answer. A small
real-wiki probe demonstrated the failure shape: two natural questions returned
no results under strict AND, while an OR-oriented query over the same existing
FTS index ranked the directly relevant page first.

The defect is therefore not “FTS instead of BM25.” FTS5 supplies the inverted
index and query engine; BM25 ranks matches. The defects are the candidate-query
policy and the page-sized indexed unit.

## Product behavior

The public interaction remains:

```text
codealmanac search <question> -> ranked pages -> codealmanac show <page>
```

Search internally ranks page sections and then collapses them to pages. A
result retains its best matching heading and excerpt. Existing consumers that
need only the page slug remain valid; human and JSON presentation may expose
the additive match evidence deliberately when the implementation plan freezes
the terminal contract.

Topics and file mentions remain deterministic structured filters. They do not
become text tokens and are not folded into BM25.

## Index shape

Markdown stays the authored source of truth. The rebuildable per-repository
SQLite index projects coherent sections derived from the existing Markdown
token stream:

```text
page_sections
├── page_slug
├── section_id
├── heading_path
├── ordinal
└── body

fts_sections
├── page_slug
├── page_title
├── heading
└── body
```

The implementation should reuse the installed `markdown-it-py` parser rather
than introduce a second Markdown parser or split headings with regular
expressions. Section identity must be deterministic across index rebuilds.

## Query and ranking contract

The lexical query analyzer will:

- preserve meaningful names, identifiers, dates, acronyms, and technical terms;
- avoid requiring ordinary question scaffolding such as “how does” or “where
  is” for candidate eligibility;
- use recall-oriented candidate matching rather than all-token AND;
- leave exact topic and file-reference filtering to their existing stores;
- escape all FTS syntax rather than accepting raw user query operators.

SQLite FTS5 performs BM25 ranking. Page title and section heading should carry
more weight than section body text. Multiple strong sections from one page do
not flood the final result list: the result projection groups by page and
retains the best match evidence with deterministic tie-breaking.

Exact weights, term policy, section-size rules, and tie-breaks belong in the
implementation plan and must be frozen before the Memento scored run. They are
search policy, not user-facing configuration knobs.

## Responsibility boundaries

```python
query = search_queries.analyze(request.query)
matches = index.search_sections(query, request.topics, request.mentions)
pages = search_results.collapse_by_page(matches)
```

- Wiki parsing owns Markdown meaning.
- Index projection owns derived section rows and FTS persistence.
- Index read views own SQL matching and BM25 ordering.
- Search service owns the page-oriented product result.
- CLI, viewer, and JSON edges render the same typed result; they do not rank.

Do not add a generic retriever registry for one implementation. The existing
service/store boundary is the seam. If semantic retrieval later becomes a
second real candidate generator, introduce the smallest service-owned port at
that time and fuse normalized ranked lists above persistence integrations.

## Future hybrid threshold

Dense retrieval is justified only when an auditable query set shows repeated
cases where:

1. the wiki contains a relevant section;
2. section-level lexical search fails to place it inside the useful context
   budget because meaningful lexical overlap is absent; and
3. a hybrid arm improves both real CodeAlmanac queries and declared benchmark
   categories without materially harming exact identifier, path, error-string,
   or configuration-key searches.

If justified, semantic retrieval supplements lexical candidates. It does not
replace them. Ranked lists should be fused with a score-independent method such
as reciprocal rank fusion before any optional reranking.

## Validation

The implementation must preserve existing topic/mention behavior and terminal
output unless an explicit additive output contract is accepted. Validation
must include:

- strict-AND regression questions that currently return no results;
- titles, headings, identifiers, dates, paths, and exact error strings;
- deterministic section identities and index rebuilds;
- multiple matching sections collapsing to one page;
- topic and mention filters composed with text search;
- empty and punctuation-only queries;
- human, JSON, viewer, and service-level result parity;
- latency on a real wiki and an enlarged synthetic wiki;
- Memento stock-search versus section-search comparison under frozen budgets.

## Explicit non-goals

- embedding generation or vector storage;
- an external search server;
- LanceDB, Tantivy, Elasticsearch, Meilisearch, or a Python BM25 reimplementation;
- LLM query rewriting;
- agentic iterative retrieval;
- user-configurable ranking weights;
- changing Markdown page identity or the `search -> show` mental model.

# Concepts

codealmanac is built around five core concepts. Each one builds on the previous.

## 1. Pages

A page is a markdown file in `.almanac/pages/`. Each one documents one piece of knowledge.

```markdown
---
title: Supabase
topics: [stack, database]
files:
  - src/lib/supabase.ts
  - backend/src/models/
---

# Supabase

PostgreSQL hosted on Supabase. Connection pooling via Supavisor.

## Gotchas
- Supavisor has a 30s idle timeout — long transactions get killed ([[supavisor-timeout]]).
- UUIDs as primary keys, not `serial` ([[uuid-decision]]).
```

Every page has **frontmatter** (YAML metadata: title, topics, files) and a **body** (the actual knowledge, regular markdown with `[[wikilinks]]`).

The filename is the slug: `supabase.md` → slug `supabase`. Always kebab-case.

Pages tend toward four shapes, though nothing enforces them:

- **Entity pages** — stable named things (Supabase, Stripe, a custom auth system). Anchors other pages link to.
- **Decision pages** — why X over Y, with context and consequences.
- **Flow pages** — how a multi-file process works end-to-end.
- **Gotcha pages** — specific failures or constraints, usually anchored to an entity.

## 2. Topics

Topics are categories for pages, organized as a **directed acyclic graph (DAG)**. Unlike flat folders, a topic can have multiple parents, and a page can belong to multiple topics.

```
decisions    stack       flows       systems
               \         /           /    \
               agents              cli   storage
```

Topics are defined in `.almanac/topics.yaml` and assigned to pages via frontmatter:

```yaml
topics: [stack, database]
```

Query by topic:

```bash
almanac topics list                         # all topics with page counts
almanac topics show database --descendants  # walk the subgraph
almanac search --topic flows                # pages in a topic
```

Cycles are prevented by a `CHECK` constraint and a depth cap of 32.

## 3. Files

Pages can reference source code files they're about. This creates a bridge between the wiki and your actual codebase.

**Frontmatter `files` field** — explicit declaration:

```yaml
files:
  - src/lib/supabase.ts
  - backend/src/models/
```

**Inline `[[...]]` links** — references in the body text. The indexer classifies them by content:

```markdown
See [[checkout-flow]] for the full sequence.           ← page link (no slash)
The handler [[src/checkout/handler.ts]] does X.        ← file ref (has slash)
This spans [[src/checkout/]] generally.                ← folder ref (trailing slash)
See [[openalmanac:supabase]] for cross-wiki context.   ← cross-wiki (colon before slash)
```

The killer feature is `--mentions`:

```bash
almanac search --mentions src/lib/supabase.ts    # pages about this file
almanac search --mentions src/lib/               # pages about anything in this folder
```

When an AI agent is about to modify a file, it can find every wiki page that documents decisions, gotchas, or invariants about that file — _before_ touching the code.

## 4. The database

Every query command is backed by a SQLite database at `.almanac/index.db`. The indexer parses all markdown pages and `topics.yaml` into tables:

```
pages             — one row per .md file (slug, title, hash, mtime)
topics            — topic definitions (slug, title, description)
page_topics       — page ↔ topic many-to-many
topic_parents     — DAG edges between topics
file_refs         — file/folder references from pages
wikilinks         — page → page links
cross_wiki_links  — cross-wiki links
fts_pages         — FTS5 full-text index (powers `almanac search`)
```

The index rebuilds **silently and automatically**. Every query command compares page file mtimes against the database; only changed or new pages are re-parsed. No progress bars, no "indexing..." messages. `almanac reindex` is the escape hatch to force a full rebuild.

The markdown files are the **source of truth**. The database is a **derived cache**. Delete `index.db` and the next command rebuilds it from scratch.

## 5. CLI

The CLI is organized into four groups:

| Group | Commands | AI needed? |
|---|---|---|
| **Query** | `search`, `show`, `health`, `list` | No |
| **Edit** | `tag`, `untag`, `topics` | No |
| **Wiki lifecycle** | `init`, `capture`, `ingest`, `garden`, `jobs`, `automation`, `reindex` | `init`, `capture`, `ingest`, and `garden` only |
| **Setup** | `setup`, `uninstall`, `doctor`, `update` | No |

Only lifecycle write commands use AI: `init` builds the first wiki, `capture` absorbs session transcripts, `ingest` absorbs user-selected files or folders, and `garden` improves the existing graph. Everything else is pure local.

Automatic capture is scheduler-driven. `almanac automation install` registers a local scheduler job that periodically runs `almanac capture sweep`; the sweep scans quiet Claude/Codex transcripts, maps them back to repos with `.almanac/`, and starts ordinary background capture jobs for new material.

Everything is designed to pipe. Commands that feed another command should use
slug-only output; `--json` gives structured output; `show --stdin` emits JSON
Lines; `--stdin` accepts piped input where supported. `search --summaries`
adds one-line summaries for scan-friendly terminal browsing, while
`search --slugs` forces slug-only output.

```bash
almanac search --topic flows --slugs | almanac show --stdin
almanac search --stale 90d | almanac tag --stdin needs-review
```

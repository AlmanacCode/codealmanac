# codealmanac

A living wiki for codebases, maintained by AI agents. Documents what the code can't say: decisions, flows, invariants, incidents, gotchas. The primary consumer is the AI coding agent; the secondary consumer is humans.

**CLI binary:** `codealmanac` (alias: `almanac`)
**Package:** `codealmanac` on npm
**Repo:** `github.com/openalmanac/codealmanac` (planned — lives in a separate repo under `~/Desktop/Projects/`)

---

## The Problem

AI coding agents (Claude Code, Cursor, Copilot) can read code and understand *what* it does. They can't understand:

- **Why** it's shaped that way (decisions, rejected alternatives)
- **What was tried and failed** (experiments, incidents)
- **What must not be violated** (invariants, constraints)
- **What's in flux** (active migrations, half-done work)
- **How things flow end-to-end** (cross-service paths)

This knowledge lives in Slack threads, PR descriptions, meeting notes, and people's heads. It dies when threads scroll, people leave, or context switches. Plans generated during coding sessions go stale within weeks. CLAUDE.md files don't scale past a single flat file.

## The Product

A wiki that captures this knowledge as atomic, interlinked pages organized by topics. An AI agent maintains it from coding sessions via a writer/reviewer pipeline triggered at session end. A CLI provides the query and organization interface.

## Core Thesis

**The wiki documents what the code can't say.** Not what the code does — the code says that. The wiki captures: why, what was rejected, what must not be violated, what surprised us, how things flow.

## Design Philosophy

**Intelligence in the prompt, not in the pipeline.** Whenever a task calls for judgment — identifying what matters in a repo, deciding whether a session produced notable knowledge, evaluating a proposal against the graph — the system hands it to an agent with a concrete-but-open prompt. It does not wrap agents in propose/review/apply state machines, intermediate artifact files, or `--dry-run` rehearsal flags. If the agent is smart enough to do the work, it's smart enough to do the work directly.

The prompts we ship are modeled on OpenAlmanac's writing/review guidelines: substantial (80-150 lines), opinionated about standards, specific about what to cover and what to avoid — but open about process. The agent decides how to execute.

The system's code owns only what prompts can't: SQLite indexing, CLI query primitives, file watching, hook wiring. Everything that smells like a pipeline between agents (proposal file → review step → apply flag) is almost certainly over-engineered — replace it with a longer prompt.

---

## Architecture

### Storage — two levels

```
~/.almanac/                  ← global, user-level
  config.json                ← global settings
  registry.json              ← registered wikis across all repos

repo/.almanac/               ← project-level, committed
  README.md                  ← conventions, topic taxonomy, page templates, notability bar
  index.db                   ← gitignored — derived SQLite index
  pages/                     ← committed — all wiki pages
    supabase.md
    checkout-flow.md
    jwt-vs-sessions.md
```

**`.gitignore` entry (per-repo):**
```
.almanac/index.db
```

**Why `.almanac/` as the flat namespace, not `.almanac/wiki/`:** The wiki *is* the thing. Future features get peer files or directories alongside `pages/` without nesting ceremony.

**Why README.md as the guide:** GitHub auto-renders it when someone browses to `.almanac/`. The name is universally understood as "start here." The repo's own README lives at a different path, so no collision.

### Organization — topics as DAG

**One axis: Topics.** Topics form a directed acyclic graph — a topic can have multiple parents. Pages belong to multiple topics. No rigid type system.

"Decisions" is a topic. "Auth" is a topic. A page about "Why JWTs" belongs to both. Multi-parent DAG handles cross-cutting naturally.

There are no enforced page types (decision, flow, invariant, etc.). These can be topics if the team wants them, or just conventions in README.md. The system doesn't distinguish between a "domain topic" (Auth) and a "form topic" (Decisions).

### Multi-wiki — the global registry

**Each repo has its own `.almanac/`.** No shared database. Each wiki is sovereign, like git repos themselves.

**`~/.almanac/registry.json` tracks all registered wikis:**
```json
[
  {
    "name": "openalmanac",
    "description": "Knowledge base platform — Next.js frontend, FastAPI backend",
    "path": "/Users/rohan/Desktop/Projects/openalmanac",
    "registered_at": "2026-04-15T19:00:00Z"
  },
  {
    "name": "data-pipeline",
    "description": "Python data pipeline — ETL + analytics",
    "path": "/Users/rohan/Desktop/Projects/data-pipeline",
    "registered_at": "2026-04-20T12:00:00Z"
  }
]
```

**Registration happens on `almanac init`.** If `almanac` is invoked in a repo with an existing `.almanac/` that isn't registered, it silently auto-registers on first command (cloning a repo and running `almanac` anywhere in it just works).

**Cross-wiki references use qualified wikilink syntax:**
```markdown
See [[openalmanac:supabase]] for how the main platform uses RLS.
```

The segment before `:` resolves via the registry. Lazy resolution — if the target wiki isn't registered or its path is temporarily unreachable, `almanac health` notes the unresolvable link; no runtime dependency, no error.

**Discovery and cross-wiki search:**
```bash
almanac list                                   # all registered wikis
almanac search --wiki openalmanac "RLS"        # search a specific wiki
almanac search --all "RLS"                     # search all registered wikis
```

**Registry hygiene:** entries are never auto-dropped. Paths can be temporarily unreachable (unmounted drive, branch switch, VM offline) without losing the registration. Unreachable wikis are silently skipped in `--all` searches. If a user wants to remove an entry explicitly:

```bash
almanac list --drop <name>                     # explicit removal from registry
```

### The Wiki README (repo/.almanac/README.md)

A committed markdown file that tells the agent:
- **What kinds of knowledge to capture** (the notability bar — see below)
- **What conventions to follow** when writing pages
- **What topics exist** and what they mean
- **What page templates to use** for different knowledge types

Editable by the team, like CLAUDE.md. Different README = different wiki personality. Reviewer consults it to enforce project-specific conventions.

---

## Linking — the graph

### The unified `[[...]]` syntax

One syntax for all link types, disambiguated by content.

```markdown
See [[checkout-flow]] for the full sequence.            ← page slug (no slash)
The handler [[src/checkout/handler.ts]] does X.         ← file reference (has slash)
This spans [[src/checkout/]] generally.                 ← folder reference (trailing slash)
See [[openalmanac:supabase]] for cross-wiki context.    ← cross-wiki (colon prefix)
```

**Classification rules (applied in order):**
1. Contains `:` before any `/` → cross-wiki reference (`wiki:slug`)
2. Contains `/` → file or folder reference (trailing `/` = folder)
3. Otherwise → page slug wikilink

**Indexed into three tables:** page-to-page links → `wikilinks`, file/folder refs → `file_refs`, cross-wiki → `cross_wiki_links`.

### Frontmatter — explicit structured metadata

Frontmatter captures what doesn't fit naturally in prose (topics) and offers an escape hatch for declaring file coverage without weaving every path into the body.

```yaml
---
title: Checkout Flow
topics: [checkout, payments]
files:
  - src/checkout/handler.ts
  - src/checkout/cart.ts
  - src/payments/
---
```

Fields:
- **`title:`** — optional; falls back to H1, then filename
- **`topics:`** — required for organization
- **`files:`** — optional; merged with inline `[[path]]` refs during indexing
- **`archived_at:`, `superseded_by:`, `supersedes:`** — lineage metadata (see Archive)

### External links — standard markdown

URLs, PRs, commits use plain markdown syntax. Not indexed — opaque strings.

```markdown
This was decided in Q3 ([PR #847](https://github.com/org/repo/pull/847)).
The migration commit is [`a3f2b1c`](https://github.com/org/repo/commit/a3f2b1c).
```

### What the indexer extracts

On reindex, for each page:
1. Parse frontmatter → `title`, `topics`, `files`, lineage fields
2. Regex-scan body for `\[\[([^\]]+)\]\]`
3. For each match, classify by rules above
4. Write rows to `pages`, `page_topics`, `file_refs`, `wikilinks`, `cross_wiki_links`, `fts_pages`

**Prose outside `[[...]]` is just prose.** No backtick-path heuristics, no false positives from code blocks or log output.

---

## Graph querying — storage and SQL

### Schema

```sql
-- Pages: one row per .md file
CREATE TABLE pages (
  slug          TEXT PRIMARY KEY,
  title         TEXT,
  file_path     TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  updated_at    INTEGER NOT NULL,  -- file mtime (epoch seconds)
  archived_at   INTEGER,           -- NULL = active; epoch seconds = archived
  superseded_by TEXT                -- slug of replacement page
);

-- Topics: the DAG nodes
CREATE TABLE topics (
  slug        TEXT PRIMARY KEY,
  title       TEXT,
  description TEXT
);

-- Page ↔ Topic: many-to-many
CREATE TABLE page_topics (
  page_slug  TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  topic_slug TEXT NOT NULL REFERENCES topics(slug),
  PRIMARY KEY (page_slug, topic_slug)
);

-- Topic parents: DAG edges (cycle-checked at insert time)
CREATE TABLE topic_parents (
  child_slug  TEXT NOT NULL REFERENCES topics(slug),
  parent_slug TEXT NOT NULL REFERENCES topics(slug),
  PRIMARY KEY (child_slug, parent_slug),
  CHECK (child_slug != parent_slug)
);

-- File/folder references
CREATE TABLE file_refs (
  page_slug TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  path      TEXT NOT NULL,            -- normalized (see below)
  is_dir    INTEGER NOT NULL,
  PRIMARY KEY (page_slug, path)
);
CREATE INDEX idx_file_refs_path ON file_refs(path);

-- Wikilinks: page → page (targets may be broken)
CREATE TABLE wikilinks (
  source_slug TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  target_slug TEXT NOT NULL,
  PRIMARY KEY (source_slug, target_slug)
);

-- Cross-wiki links
CREATE TABLE cross_wiki_links (
  source_slug TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  target_wiki TEXT NOT NULL,           -- registered wiki name
  target_slug TEXT NOT NULL,
  PRIMARY KEY (source_slug, target_wiki, target_slug)
);

-- Full-text search
CREATE VIRTUAL TABLE fts_pages USING fts5(slug, title, content);
```

### Query examples

**`almanac search --mentions src/checkout/handler.ts`** — pages about this file OR a folder containing it.

Use `GLOB` not `LIKE` (see Correctness below):
```sql
SELECT DISTINCT p.slug
FROM pages p JOIN file_refs r ON r.page_slug = p.slug
WHERE p.archived_at IS NULL
  AND (
    r.path = 'src/checkout/handler.ts'
    OR (r.is_dir = 1 AND 'src/checkout/handler.ts' GLOB r.path || '*')
  );
```

**`almanac search --mentions src/checkout/`** — pages about this folder OR any file inside it.
```sql
SELECT DISTINCT p.slug
FROM pages p JOIN file_refs r ON r.page_slug = p.slug
WHERE p.archived_at IS NULL
  AND (r.path = 'src/checkout/' OR r.path GLOB 'src/checkout/*');
```

**`almanac topics show auth --descendants`** — all pages in auth OR its subtopics (DAG traversal with cycle guard):
```sql
WITH RECURSIVE descendants(slug, depth) AS (
  SELECT 'auth', 0
  UNION
  SELECT tp.child_slug, d.depth + 1
  FROM topic_parents tp
  JOIN descendants d ON tp.parent_slug = d.slug
  WHERE d.depth < 32   -- defense in depth; CHECK prevents self-loops, depth caps pathological cases
)
SELECT DISTINCT p.slug FROM pages p
JOIN page_topics pt ON pt.page_slug = p.slug
WHERE pt.topic_slug IN (SELECT slug FROM descendants)
  AND p.archived_at IS NULL;
```

**`almanac health` — broken wikilinks:**
```sql
SELECT w.source_slug, w.target_slug FROM wikilinks w
LEFT JOIN pages p ON p.slug = w.target_slug
WHERE p.slug IS NULL;
```

**`almanac search --archived`:**
```sql
SELECT slug FROM pages WHERE archived_at IS NOT NULL ORDER BY archived_at DESC;
```

### Indexing strategy

Every CLI command compares mtimes of `.almanac/pages/*.md` vs `index.db`. If any page is newer, reindex. Per-page: `content_hash` comparison skips unchanged files; changed pages get their rows replaced transactionally.

**Performance budget:** parsing 500 frontmatters + one regex pass + FTS5 rebuild < 500ms. Full-scan is the only strategy until size forces otherwise.

### Correctness — edge cases and rules

**Path normalization.** All paths stored in `file_refs.path` are normalized at index time:
- Lowercase (to handle macOS case-insensitive filesystems)
- Forward slashes (never backslashes)
- No leading `./`
- Trailing slash iff `is_dir=1`
- Collapse redundant slashes

Queries normalize input before matching.

**`GLOB` over `LIKE`.** SQLite's `LIKE` treats `_` as a single-character wildcard, which matches spuriously on paths like `src/my_module/`. `GLOB` treats `_` literally. Use `GLOB` for all path comparisons.

**Slug canonicalization.** Page slug = kebab-case of the filename (without `.md`). Enforced at write time. `Checkout Flow.md` → warn and rename to `checkout-flow.md`. Underscores are normalized to hyphens in slugs (but NOT in paths). This means `checkout-flow`, `checkout_flow`, and `Checkout Flow` resolve to the same slug; `almanac init` and the reviewer reject duplicates.

**DAG cycle prevention.** `CHECK (child_slug != parent_slug)` prevents self-loops. The recursive CTE uses a depth cap (32) as belt-and-suspenders. `almanac topics link <child> <parent>` runs a pre-insert check: reject if creating this edge would form a cycle.

**Monorepos / nested `.almanac/`.** The CLI walks up from `cwd` to find the nearest `.almanac/` (like git). A monorepo can have one wiki at the root or per-workspace wikis; whichever is closest wins. The registry stores absolute paths, so cross-wiki links via `[[other-wiki:slug]]` still work across workspaces.

### Version Control

Pages are updated in-place to reflect current truth. Git history is the archive. When a decision changes with minor impact:

```markdown
We migrated to async Stripe calls in March 2026 ([`a3f2b1c`]).
Previously used synchronous calls for consistency ([`e7d91f4`]).
```

No `status: deprecated`. Old decisions live in git, pinned to specific commits inline. For major reversals, use the archive mechanism below.

---

## Archive — lineage for fundamental reversals

When a page's **central decision is reversed** (not just edited), the reviewer proposes archiving rather than overwriting. The old page stays in `pages/` but gets flagged; a new page is created for the current approach. Two related documents now exist, linked by lineage metadata.

### Mechanism

**Archived page** (old approach, preserved):
```yaml
---
title: Synchronous Stripe Calls
topics: [payments, archive]
archived_at: 2026-04-15
superseded_by: stripe-async
files:
  - src/payments/stripe-sync.ts   # may no longer exist — dead refs are expected on archives
---

# Synchronous Stripe Calls

(Archived 2026-04-15. Replaced by [[stripe-async]].)

We made synchronous Stripe API calls inline with checkout because we
wanted strong consistency — a completed checkout meant a completed
payment. This broke under webhook retries [[stripe-deadlock]], so we
moved to an async queue in April 2026.
```

**Current page** (new approach):
```yaml
---
title: Stripe Async Pipeline
topics: [payments]
supersedes: stripe-sync
---
```

### Search behavior

```bash
almanac search "stripe"                  # → stripe-async (archived excluded by default)
almanac search "stripe" --include-archive  # → stripe-async, stripe-sync
almanac search --archived                # → archived pages only

almanac info stripe-async                # shows "supersedes: stripe-sync"
almanac info stripe-sync                 # shows "archived_at, superseded_by"

almanac health                           # does NOT flag dead-refs on archived pages
```

Backlinks still resolve: anything linking to `[[stripe-sync]]` finds it — just marked as archived.

### Reviewer's archive criteria

Archive when:
- The page's **central recommendation is reversed** ("use X" → "don't use X")
- The approach described is no longer how we do things
- The replacement is **substantially different** enough that merging would create a confusing Frankenstein

Don't archive when:
- The page is being updated with new details (just edit in place)
- Only a small part of the approach changed (edit + "Previously..." paragraph)
- Restructuring or renaming (just rename the file / update slug)

### Two lineage tools

| Tool | When | What it looks like |
|------|------|--------------------|
| **Inline "Before..." paragraph** | Small pivots within a still-current page | A "History" section at the bottom of the current page |
| **Archive flag + new page** | Fundamental reversals where both documents have value | `archived_at` + `superseded_by` on old, `supersedes` on new |

The reviewer decides which is appropriate.

---

## Entity Pages — technology knowledge

Pages about specific technologies used in the repo. Not a first-class concept — just pages tagged with the `stack` topic. But important enough to call out.

An entity page about "Supabase" isn't generic docs. It's **repo-specific knowledge**: how we use it, how it's configured, why we chose it, known gotchas, relevant files.

```markdown
---
title: Supabase
topics: [stack, database]
files:
  - src/lib/supabase.ts
  - docker-compose.yml
  - backend/src/models/
---

PostgreSQL hosted on Supabase. Connection pooling via Supavisor.

## Why Supabase
Chose over PlanetScale in January 2026 for Row Level Security and
realtime subscriptions. See [[database-decision]].

## Configuration
Connection string in Doppler. Migrations in [[backend/scripts/]],
run via `doppler run -- psql`.

## Gotchas
- Supavisor has a 30s idle timeout — long transactions get killed
- UUIDs as primary keys, not `serial` ([[uuid-decision]])
```

### Bootstrap — seeding entity pages

```bash
almanac bootstrap
```

Spawns a bootstrap agent (same SDK as capture). The agent reads `package.json` / `pyproject.toml` / `docker-compose.yml` / `README.md` / `CLAUDE.md` and the top-level directory structure, identifies meaningful anchors (grouping related dependencies), proposes a topic DAG, and writes stub pages + `README.md` directly to `.almanac/`.

No intermediate proposal file, no `--apply` flag, no user review step. The agent reads the repo and creates the scaffolding. If the user doesn't like it, they edit the files (or delete and re-run).

Full prompt: [`codebase-wiki-prompts/bootstrap.md`](./codebase-wiki-prompts/bootstrap.md)

---

## Writing conventions

The wiki is primarily for AI agents, but it **must remain human-readable and neutral**. Pages are documentation of what is, not analysis of what it means.

OpenAlmanac already maintains detailed writing guidelines in `skills/openalmanac/references/`. codealmanac's reviewer loads the relevant subset at runtime. The core rules:

### Every sentence contains a fact

> "Every sentence should contain a specific fact the reader didn't know before."

Bad: "The checkout handler plays an important role in the payment flow."
Good: "The checkout handler at `src/checkout/handler.ts` validates cart state, locks inventory via Redis, and calls the Stripe async queue."

### Neutral tone

- Use "is" not "serves as" or "stands as"
- No promotional language (`boasts`, `vibrant`, `rich`, `profound`, `groundbreaking`)
- No significance inflation (`plays a pivotal role`, `serves as a testament`, `underscores its importance`)
- No interpretive `-ing` clauses ("highlighting his importance", "reflecting the team's priorities")
- No vague attribution ("experts argue", "industry reports suggest")

### No speculation, no hedging

> "If you don't have information, don't write the sentence."

Don't write "While specific details are limited..." or "Based on available information...". Omit what you don't know.

### Prose over bullets over tables

- Default: dense prose with specific facts
- Bullets: when you have a genuine list (configuration values, gotchas, steps)
- Tables: only when you have structured comparison data — not for two-row, two-column filler

### Reference code explicitly

Use `[[path]]` wikilinks for file and folder references. Inline mentions in prose are fine but won't be indexed — only `[[...]]` counts.

### No formulaic conclusions

> "Encyclopedic articles don't need a concluding section. End with the last substantive fact."

### Evolving, not static

Pages are living documents. Success is not "I wrote a new page" — success is "the wiki accurately reflects the current state." That means:
- Updating existing pages when facts change
- Archiving pages when decisions reverse
- Merging duplicates
- Splitting pages that grew into multiple concerns
- Adding missing links between related pages

The full writing and review guidelines are reachable at `skills/openalmanac/references/` — the reviewer consults them per page.

---

## The CLI

The CLI is the query and organization interface. No AI, no generation — it finds stuff, organizes the graph, and surfaces problems. The writer/reviewer pipeline (invoked from `almanac capture`) is the only command that touches AI.

### Design Principles

1. **Every command that returns pages outputs slugs by default** (one per line, pipe-friendly)
2. **`--json` for structured output** (agent consumption)
3. **Commands accept slugs from stdin** via `--stdin` (enables piping)
4. **The CLI never reads or writes page content** — it operates on the index only (except `capture`, which orchestrates)
5. **Reindex is implicit** — every command rebuilds if pages are newer than `index.db`

### Commands

```bash
# ══════════════════════════════════════════════════════════
# INIT — scaffold a wiki, register it globally
# ══════════════════════════════════════════════════════════

almanac init                                    # creates .almanac/, scaffolds README.md, registers
almanac init --name openalmanac --description "..."

# ══════════════════════════════════════════════════════════
# LIST — global discovery
# ══════════════════════════════════════════════════════════

almanac list                                    # all registered wikis (name, description, path)
almanac list --json
almanac list --drop <name>                      # explicit removal from registry

# ══════════════════════════════════════════════════════════
# SEARCH — the core query
# ══════════════════════════════════════════════════════════

almanac search "checkout timeout"               # FTS5 text search
almanac search --topic auth                     # all pages in topic
almanac search --topic auth --topic decisions   # intersection (AND)
almanac search --mentions src/checkout/handler.ts    # pages referencing this file
almanac search --mentions src/checkout/              # pages referencing files in this folder
almanac search --since 2w                       # recently updated
almanac search --stale 30d                      # NOT updated in 30+ days
almanac search --orphan                         # pages with no topics

# Archive scope:
almanac search --include-archive "stripe"       # active + archived
almanac search --archived                       # archived only

# Cross-wiki:
almanac search --wiki openalmanac "RLS"         # specific registered wiki
almanac search --all "RLS"                      # all registered wikis

# Filters compose (AND logic):
almanac search --mentions src/checkout/ --stale 30d
almanac search "timeout" --topic checkout

# ══════════════════════════════════════════════════════════
# SHOW / PATH / INFO — inspect single pages
# ══════════════════════════════════════════════════════════

almanac show <slug>                             # cat the page file
almanac path <slug>                             # resolve slug → absolute file path
almanac info <slug>                             # topics, file_refs, wikilinks, lineage, updated_at
almanac info --stdin                            # bulk info from stdin

# ══════════════════════════════════════════════════════════
# CAPTURE — writer/reviewer pipeline (AI-powered)
# ══════════════════════════════════════════════════════════

almanac capture                                 # runs writer agent on latest session transcript
almanac capture <transcript-path>               # explicit transcript
almanac capture --session <id>                  # target specific session

# ══════════════════════════════════════════════════════════
# TOPICS — manage the DAG
# ══════════════════════════════════════════════════════════

almanac topics                                  # list all with page counts
almanac topics show <slug>                      # description + pages + parents + children
almanac topics show <slug> --descendants        # include subtopic pages (DAG traversal)
almanac topics create <name> --parent <slug>
almanac topics link <child> <parent>            # add parent edge (cycle-checked)
almanac topics unlink <child> <parent>          # remove parent edge
almanac topics rename <old> <new>               # updates all page frontmatter
almanac topics delete <slug>                    # untags pages, doesn't delete them
almanac topics describe <slug> "<text>"

# ══════════════════════════════════════════════════════════
# TAG — connect pages to topics
# ══════════════════════════════════════════════════════════

almanac tag <slug> <topic> [<topic>...]
almanac untag <slug> <topic>
almanac tag --stdin <topic>                     # tag all pages from stdin

# ══════════════════════════════════════════════════════════
# HEALTH — surface problems
# ══════════════════════════════════════════════════════════

almanac health                                  # full report
almanac health --topic <name>                   # scoped
almanac health --stdin                          # check specific pages from stdin

# Report categories:
#   orphans        — pages with no topics
#   stale          — pages not updated in 90+ days (active only)
#   dead-refs      — file/folder no longer exists (active only; archives exempt)
#   broken-links   — wikilinks to non-existent pages
#   broken-xwiki   — cross-wiki links to unregistered or unreachable wikis
#   empty-topics   — topics with 0 pages
#   empty-pages    — pages with no content
#   slug-collisions — two files slugify to the same slug

# ══════════════════════════════════════════════════════════
# GRAPH — visualize the link structure
# ══════════════════════════════════════════════════════════

almanac graph                                   # dump link graph (mermaid default)
almanac graph --format mermaid
almanac graph --format json
almanac graph --topic <name>                    # scope to topic subgraph
almanac graph --around <slug> --depth 2         # neighborhood of a page

# ══════════════════════════════════════════════════════════
# DIFF — what changed in the wiki
# ══════════════════════════════════════════════════════════

almanac diff                                    # wiki changes since last git commit
almanac diff <commit>                           # since specific commit
almanac diff --since 7d                         # time-based

# ══════════════════════════════════════════════════════════
# BOOTSTRAP / REINDEX
# ══════════════════════════════════════════════════════════

almanac bootstrap                               # scan repo, propose entity pages + topic DAG
almanac reindex                                 # force rebuild index.db

# ══════════════════════════════════════════════════════════
# Global flags
# ══════════════════════════════════════════════════════════

--json                                          # structured output (default: slugs/pretty)
--limit N                                       # cap results
--stdin                                         # read slugs from stdin
--wiki <name>                                   # target a specific registered wiki
--all                                           # query all registered wikis
--include-archive                               # include archived pages
--archived                                      # archived pages only
```

### Chaining

Commands compose via unix pipes. Query commands output slugs (one per line); mutation/inspection commands accept `--stdin`.

```bash
# ── Find pages about changed files, check their health ──
almanac search --mentions src/checkout/handler.ts | almanac health --stdin

# ── Find stale pages in a topic, get their metadata ──
almanac search --topic auth --stale 30d | almanac info --stdin --json

# ── Bulk retag: move pages from old topic to new ──
almanac search --topic old-name | almanac tag --stdin new-name

# ── Find pages referencing deleted files ──
almanac health --json | jq -r '.dead_refs[].slug'
```

### Non-features (intentionally excluded)

- **No `almanac read/write/edit`** — agent has Read/Write/Edit tools
- **No `--semantic` search** — FTS5 first; defer until proven insufficient
- **No raw SQL `almanac query`** — schema is simple; read `index.db` directly if needed

---

## Writer/Reviewer Pipeline

The heart of the system: how the wiki stays alive without human discipline.

### Trigger — `SessionEnd` hook

The pipeline runs **once, when the conversation ends** — not after every turn. Configured via Claude Code's `SessionEnd` hook:

```json
{
  "hooks": {
    "SessionEnd": [{
      "type": "command",
      "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/almanac-capture.sh",
      "timeout": 10
    }]
  }
}
```

Hook script:

```bash
#!/bin/bash
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path')
CWD=$(echo "$INPUT" | jq -r '.cwd')

# Run pipeline in background, non-blocking
(
  cd "$CWD"
  almanac capture "$TRANSCRIPT" \
    --session "$SESSION_ID" \
    > "$CWD/.almanac/.capture-$SESSION_ID.log" 2>&1
) &

exit 0
```

Results: new/updated pages land in `.almanac/pages/` and show up in the user's next `git status`. No blocking, no interactive prompts, no per-turn noise.

### Architecture — writer with reviewer subagent

One pipeline, not a state machine. The **writer** is the main agent. It has a **reviewer subagent** it invokes when it wants feedback. The writer decides what to do with the feedback.

Implementation uses `@anthropic-ai/claude-agent-sdk` (same SDK the GUI uses for the article-writer → reviewer/fact-checker pattern).

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const agents = {
  reviewer: {
    description:
      "Reviews proposed wiki pages against the full knowledge base for " +
      "cohesion, duplication, missing links, notability, and writing conventions.",
    prompt: REVIEWER_PROMPT,
    tools: ["Read", "Grep", "Glob", "Bash"],  // read-only + almanac queries
  },
};

for await (const msg of query({
  prompt: `Capture this coding session.\nTranscript: ${transcriptPath}`,
  options: {
    systemPrompt: WRITER_PROMPT,
    agents,
    allowedTools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash", "Agent"],
    cwd: repoRoot,
  },
})) {
  // stream messages to .almanac/.capture-<session>.log
}
```

**Tool scoping:**
- **Writer** has Read/Write/Edit/Grep/Glob/Bash + Agent (to invoke reviewer). Writer owns all file changes.
- **Reviewer** has Read/Grep/Glob/Bash only. Can inspect the full graph via `almanac search`, `almanac show`, `almanac info`, can grep existing pages, but cannot write. Its output is text critique.

**No orchestration state machine.** No approve/revise/reject JSON schema. The writer's prompt says: "After drafting, invoke the reviewer. Read its feedback. Decide what to incorporate. Write the final version."

### Writer

The writer reads the session transcript and existing wiki context, decides what knowledge from the session meets the notability bar, and writes or updates pages directly. It invokes the reviewer subagent when it wants feedback on substantive changes. Silence is a valid outcome — if nothing in the session meets the bar, the writer writes nothing.

Full prompt: [`codebase-wiki-prompts/writer.md`](./codebase-wiki-prompts/writer.md)

### Reviewer

The reviewer is a subagent the writer invokes. It evaluates proposed changes against the full knowledge base — running `almanac search`, reading adjacent pages — and returns structured feedback.

The reviewer is honest, not adversarial. It approves plainly when proposals are correct; it names specific issues when it sees them; it never invents problems to satisfy a checklist. Its value is catching what the writer missed — duplicates, missing links, contradictions, cohesion problems — because it reads across the graph while the writer is focused on the delta.

Full prompt: [`codebase-wiki-prompts/reviewer.md`](./codebase-wiki-prompts/reviewer.md)

### Notability bar

Lives in each repo's `.almanac/README.md` (scaffolded by bootstrap). A sensible default:

> Write a page when there is **non-obvious knowledge** that will help a future agent:
> - A decision that took discussion or research
> - A gotcha discovered through failure
> - A cross-cutting flow that spans multiple files
> - A constraint or invariant not visible from the code
> - An entity referenced by multiple other pages
>
> Do not write pages that restate what the code does. Do not write pages of inference — only of observation.

Writer consults this before writing. Reviewer enforces it.

### Common page shapes

The wiki isn't a random collection of articles. It's organized around stable entities with cross-linking. The writer tends to reach for four page shapes, but **these are suggestions, not a schema** — nothing in the system enforces them. A page that doesn't fit any of them is fine.

- **Entity pages** — stable named things (technologies, systems, external services). These become anchors.
- **Decision pages** — "why X over Y."
- **Flow pages** — how a multi-file process works end-to-end.
- **Gotcha pages** — specific failures/surprises anchored to an entity.

Link to entities when you can. A page with no entity link often means either the page is too abstract, or the entity it should link to has no page yet. Not wrong, worth checking.

When updating a page, keep the whole page cohesive — don't just append. If the new material doesn't flow with the rest, rewrite the section or the whole page. When cohesion can't be saved, propose a split (via the reviewer).

### Why this works

- **Same SDK as GUI.** No new infrastructure. `@anthropic-ai/claude-agent-sdk`'s `query()` function with `agents: { reviewer }`. Same pattern the article-writer uses.
- **Writer owns outcomes.** No external state machine deciding approve/revise/reject. Writer reads reviewer's critique and decides — same as human code review.
- **Natural tool scoping.** Reviewer read-only (can inspect graph), writer can modify. Separation enforced by the SDK, not by our code.
- **Asymmetric failure modes addressed.** Writer hallucinates; reviewer with graph context catches hallucination. Reviewer hallucinates; explicit "approve plainly" tone prevents invented critiques.
- **SessionEnd, not Stop.** One meaningful pass per session, not per turn.
- **Background.** Non-blocking; user sees results as file changes in next `git status`.

---

## Integration — skill + hook

### Claude Code Skill

A skill installed globally teaches the agent how to use codealmanac during a session:

```markdown
# Using codealmanac

## Before starting work
Run `almanac search --mentions <files-you'll-touch>` and
`almanac search --topic <relevant-area>`. Read the top results.
Follow [[wikilinks]] for context.

## During work
If you hit a non-obvious constraint or gotcha, make a mental note —
the capture pipeline runs at session end.

## Writing conventions
Read `.almanac/README.md` for this repo's conventions and notability bar.
```

The skill is generic (tool usage). README.md is repo-specific (what to capture, formatting). The skill reads README.md at session start.

### SessionEnd hook

(Covered in Writer/Reviewer Pipeline above.)

---

## Agent Flow

### Session start

```
User: "fix the checkout timeout bug"

Agent (per the skill):
  $ almanac search --mentions src/checkout/
    → checkout-flow, inventory-lock-gotcha, stripe-async-migration

  Reads 2-3 relevant pages with Read tool. Follows [[wikilinks]] for context.
  Now knows: the flow, the known gotchas, recent changes.
  Starts working with full context.
```

### During the session

Agent fixes the bug, discovers that webhook retries can race with the inventory lock. Reads `[[stripe-deadlock]]`, realizes no page covers this specific race condition.

No writes yet. Keeps working.

### Session end

User closes Claude Code. `SessionEnd` hook fires. `almanac capture` runs in background:

1. **Writer** reads transcript + wiki context. Proposes:
   - New page: `inventory-stripe-race`, topics `[checkout, payments, incidents]`, files `[src/checkout/handler.ts, src/payments/stripe-webhook.ts]`
   - Update to `stripe-deadlock` to link to the new page
2. **Reviewer** reads proposals + runs `almanac search --topic incidents`. Approves the new page (clears notability bar: novel race condition, discovered through user's bug fix). Approves the `stripe-deadlock` update. Notes that `inventory-lock-gotcha` also mentions this area and should cross-link — proposes that too.
3. **Apply** writes `inventory-stripe-race.md`, updates `stripe-deadlock.md` and `inventory-lock-gotcha.md`.

Next time user opens the repo: `git status` shows the wiki changes. They review, commit.

### Next session (knowledge compounds)

```
Different engineer: "add discount codes to checkout"

Agent:
  $ almanac search --mentions src/checkout/
    → includes inventory-stripe-race

  Reads it. Knows about the race condition.
  Writes the feature without reintroducing the bug.
```

---

## Decisions

- **Name: `codealmanac` binary, alias `almanac`.** Package `codealmanac` on npm. Ties to OpenAlmanac brand — "Almanac is knowledge for curious people. codealmanac is knowledge for codebases."
- **Primary consumer is the AI coding agent.** Humans benefit secondarily.
- **Local-only. No hosted Almanac.** `.almanac/` folder, markdown files, SQLite index. No sync, no API.
- **Flat `.almanac/` namespace.** No `.almanac/wiki/` subdirectory. Future features get peer files/dirs.
- **`README.md`, not `WIKI.md`.** GitHub auto-renders it; universally "start here."
- **Global registry at `~/.almanac/registry.json`.** `almanac init` registers; cloning a repo with a registered `.almanac/` auto-registers silently. Entries are never auto-dropped; `almanac list --drop <name>` is the explicit removal.
- **Unified `[[...]]` syntax.** Page slugs, file refs, folder refs, cross-wiki refs — one syntax, disambiguated by content.
- **Frontmatter keeps `topics:` and `files:`.** Topics don't fit in prose; `files:` is an escape hatch.
- **`--mentions` not `--refs`.** Clearer semantic.
- **SQLite with `GLOB` (not `LIKE`) for path queries.** Avoids `_` wildcard issue.
- **Path normalization** (lowercase, forward slashes) handles macOS case-insensitive filesystems.
- **Slug canonicalization** (kebab-case of filename) prevents collisions.
- **DAG cycle prevention** via CHECK constraint + pre-insert check + recursive CTE depth cap.
- **Full rebuild indexing** (under 500ms at 500 pages). Incremental is the escape hatch.
- **SessionEnd hook, not Stop.** One pass per session, not per turn.
- **Background execution.** Non-blocking; results via git status.
- **Intelligence in prompts, not pipelines.** No propose/review/apply state machines. No `--dry-run`, no `--apply`. Agents do the work directly; prompts are opinionated-but-open.
- **Writer with reviewer subagent.** Writer owns writing; invokes reviewer as a tool when it wants feedback. SDK handles delegation via `agents: { reviewer }`.
- **Reviewer is honest, not adversarial.** Explicit "approve plainly when correct" framing.
- **Reviewer owns graph integrity.** Checks duplicates, merges, splits, contradictions, adjacent staleness, missing links, missing topics, missing file coverage.
- **Notability bar in `.almanac/README.md`.** Per-repo threshold for what deserves a page.
- **Archive mechanism** (frontmatter `archived_at`, `superseded_by`) for fundamental reversals. Small pivots use inline "Before..." paragraphs.
- **Bootstrap is agent-driven.** Reads repo, writes stubs + `README.md` directly. No proposal ceremony.
- **Page shapes are suggestions.** Entity / decision / flow / gotcha are mental models, not a schema. Nothing in the system enforces them.
- **Prompts shipped as separate files** in `codebase-wiki-prompts/` — bootstrap.md, writer.md, reviewer.md. Follow the OpenAlmanac writing-guidelines style (concrete-but-open).

## Open Questions

- **Topic summaries**: Should topic nodes have auto-generated narrative summaries synthesized from child pages?
- **Semantic search**: Vector index as a sidecar? Which embedding model? Defer until FTS5 proves insufficient.
- **Collaboration**: Concurrent writes — probably just git merge, but worth testing.
- **Slash commands**: Should codealmanac ship Claude Code slash commands (e.g. `/capture`, `/wiki`) in addition to the hook?
- **Capture cost**: Writer+reviewer are two Claude calls per session. Worth the tokens? Rate limit? Skip short sessions?
- **Transcript parsing**: `SessionEnd` gives a transcript path; parser needs to extract files touched, not just read raw JSONL. Utility library?

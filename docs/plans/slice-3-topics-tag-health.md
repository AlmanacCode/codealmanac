# Slice 3 — Topics, Tagging, Health

Third implementation slice of codealmanac. Builds on slice 1 (scaffold + registry) and slice 2 (indexer + search/show/path/info/reindex).

## Read before coding

1. **Full design spec:** `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md`
   - Focus on: Organization (topics as DAG), The CLI → Topics/Tag/Health sections, Graph querying → edge cases (cycle prevention, depth cap)
2. **Existing code in `~/Desktop/Projects/codealmanac/`:**
   - `src/cli.ts` — commander wiring pattern
   - `src/commands/init.ts`, `src/commands/list.ts` — command return shape, file I/O patterns
   - `src/registry/index.ts` — atomic file writes, JSON file handling
   - Slice 2's indexer module (wherever it landed) — schema, how it reads markdown
   - `test/helpers.ts` — `withTempHome` sandbox pattern
3. **Slice 2 code** once committed — SQLite schema, frontmatter parser, `[[...]]` classifier. You will reuse all of it.

Match the existing style. Do not introduce new patterns unless necessary.

## Scope

### Topics — manage the DAG

```bash
almanac topics                              # list all topics with page counts
almanac topics show <slug>                  # description + pages + parents + children
almanac topics show <slug> --descendants    # include pages from subtopics (DAG traversal)

almanac topics create <name> [--parent <slug>]...    # --parent repeatable
almanac topics link <child> <parent>        # add parent edge (cycle-checked)
almanac topics unlink <child> <parent>      # remove parent edge
almanac topics rename <old> <new>           # rename + rewrite frontmatter on all affected pages
almanac topics delete <slug>                # untag pages (rewrite frontmatter), remove topic
almanac topics describe <slug> "<text>"     # set/update description
```

### Tag — connect pages to topics

```bash
almanac tag <page> <topic> [<topic>...]     # add page to topics (rewrites page frontmatter)
almanac untag <page> <topic>                # remove (rewrites page frontmatter)
almanac tag --stdin <topic>                 # tag all pages from stdin
```

### Health — surface problems

```bash
almanac health                              # full report (all categories)
almanac health --topic <name>               # scoped
almanac health --stdin                      # check specific pages from stdin
almanac health --json                       # structured output
```

Report categories (each page or topic appears in 0-N categories):

| Category | Meaning |
|----------|---------|
| `orphans` | Pages with no topics |
| `stale` | Active pages not updated in 90+ days (configurable via `--stale <duration>`; default 90d) |
| `dead-refs` | Page's `file_refs` point to files/folders that no longer exist on disk (active pages only; archives exempt) |
| `broken-links` | Wikilinks to non-existent pages |
| `broken-xwiki` | Cross-wiki links to unregistered or unreachable target wikis |
| `empty-topics` | Topics with 0 pages |
| `empty-pages` | Pages with no content (frontmatter + maybe a heading, nothing else) |
| `slug-collisions` | Two files slugify to the same slug |

Default pretty output groups by category, one finding per line. `--json` emits a structured object per category.

## Out of scope

- `almanac bootstrap` (slice 4 — first Agent SDK integration)
- `almanac capture` (slice 5)
- `almanac graph` / `almanac diff` (later polish)
- `--all` multi-wiki queries (defer — only `--wiki <name>` as implemented in slice 2)

## Design decisions — topic metadata

The SQLite `topics` table has `title` and `description`, plus `topic_parents` has the DAG edges. These must be reconstructable on reindex. Page frontmatter only contains topic **slugs** (e.g., `topics: [auth, jwt]`), not titles/descriptions/parent relationships.

**Source of truth for topic metadata: `.almanac/topics.yaml`** — a single committed YAML file. Schema:

```yaml
topics:
  - slug: auth
    title: Auth
    description: Authentication and authorization
    parents: []
  - slug: jwt
    title: JWT
    description: JWT-based session auth
    parents: [auth, security]
  - slug: security
    title: Security
    description: Security-sensitive code and invariants
    parents: []
```

Rules:
- Only topics referenced by `almanac topics create`, `link`, `unlink`, `rename`, `delete`, `describe` appear here. Ad-hoc topic slugs that appear only in page frontmatter (e.g., someone types `topics: [random-thing]`) are still indexed, just with no description / no parents.
- The reindexer reads `.almanac/topics.yaml` on every rebuild. Missing file = empty topic metadata (all topics inferred from page frontmatter, no descriptions or parents).
- Topic CRUD commands read + modify + atomically rewrite this file (tmp + rename pattern).
- The reindex also ensures any slug mentioned in pages' `topics:` frontmatter gets a row in the `topics` table, even if not in `topics.yaml`. In that case, `title` defaults to a title-cased version of the slug; `description` is NULL.

This keeps the system minimal:
- Pages are source of truth for which pages belong to which topics
- `topics.yaml` is source of truth for topic metadata (title, description, DAG)
- SQLite is derived from both

## Design decisions — page frontmatter rewriting

Some commands must mutate page files:
- `almanac tag <page> <topic>` → add `<topic>` to page's `topics:` frontmatter
- `almanac untag <page> <topic>` → remove `<topic>` from page's `topics:` frontmatter
- `almanac topics rename <old> <new>` → replace every `<old>` with `<new>` in all affected pages' frontmatter
- `almanac topics delete <slug>` → remove `<slug>` from all affected pages' frontmatter

Requirements:
- **Preserve non-topics frontmatter fields exactly.** Round-trip YAML cleanly.
- **Preserve body content byte-for-byte.** The command only touches frontmatter.
- **Dedupe on add.** `almanac tag foo bar` when `bar` is already in `topics:` is a no-op.
- **Idempotent.** Re-running a tag/untag command has no additional effect.
- **Atomic per file.** Write to `.tmp` then rename.

Use a YAML library that preserves key order and comments if possible (`yaml` from `eemeli/yaml` is better than `js-yaml` for this — but slice 2 used `js-yaml`). If round-tripping fails, document the limitation; don't ship a corrupting implementation.

## Design decisions — cycle prevention (topics DAG)

`topics_parents` already has `CHECK (child_slug != parent_slug)` from slice 2 (self-loop prevention).

Cycle prevention on `almanac topics link <child> <parent>`:
- Compute ancestor set of `<parent>` via recursive CTE (depth-capped at 32)
- If `<child>` is in that ancestor set, refuse: `error: adding parent <parent> to <child> would create a cycle`
- Otherwise, insert the edge in both SQLite and `topics.yaml`

Traversal (e.g., `--descendants`) uses the depth-capped CTE. Never allow an unbounded recursion.

## Design decisions — tag / untag

`almanac tag <page> <topic>...` workflow:
1. Resolve `<page>` → slug (it's already a slug; may be the filename path for flexibility — decide and document)
2. For each `<topic>`:
   - Kebab-case the topic name (canonicalize)
   - Ensure topic exists in `topics.yaml`; if not, create a minimal entry `{ slug, title: Title Cased, description: null, parents: [] }`
   - Add to the page's frontmatter `topics:` if not present
3. Rewrite the page atomically
4. Implicit reindex on next command picks up the change

`almanac tag --stdin <topic>` reads slugs from stdin (one per line), tags each with the given topic.

`almanac untag` is the symmetric inverse. If removing the last topic would leave the page orphaned, allow it (orphans are legal; `health` just flags them).

## Health — implementation notes

Each category is a distinct query or filesystem check. Orchestrate them:

```typescript
interface HealthReport {
  orphans: { slug: string }[]
  stale: { slug: string; days_since_update: number }[]
  dead_refs: { slug: string; path: string }[]
  broken_links: { source_slug: string; target_slug: string }[]
  broken_xwiki: { source_slug: string; target_wiki: string; target_slug: string }[]
  empty_topics: { slug: string }[]
  empty_pages: { slug: string }[]
  slug_collisions: { slug: string; paths: string[] }[]
}
```

- **dead-refs** requires filesystem stat calls. Collect all unique `file_refs.path` across active pages, stat each, report those that don't exist. The path is relative to the repo root (`.almanac/..`).
- **broken-xwiki** consults the registry: for each `cross_wiki_links.target_wiki`, check the entry exists and its path is reachable. If so, further check the target page's wiki also has `<target_slug>` — this requires opening that wiki's `index.db`. If too complex for slice 3, report "target wiki unregistered or unreachable" only; don't verify slug resolution. Document the limitation.
- **slug-collisions** was detected during indexing (slice 2 warns to stderr). Persist collision events in the DB (add a small table `slug_collisions (slug, file_path)` in slice 2 or slice 3) OR rescan on health. Easier: rescan — fast-glob all pages, slugify each, report duplicates.
- **`--stale <duration>`** accepts `Nd`, `Nw`, `Nh` (reuse slice 2's duration parser). Default 90d.

Pretty output example:

```
$ almanac health

orphans (2):
  some-notes
  random-thoughts

stale (1):
  old-architecture     (124 days)

dead-refs (3):
  checkout-flow        references src/checkout/old-handler.ts (missing)
  stripe-async         references src/payments/legacy/ (missing)
  inventory-locking    references src/lib/inventory.ts (missing)

broken-links (1):
  checkout-flow → inventory-service (target does not exist)

empty-pages (0): (ok)
empty-topics (1):
  networking

slug-collisions (0): (ok)
```

`--json` output is the `HealthReport` object above, serialized.

## Tech

No new runtime dependencies expected unless YAML fidelity matters — if so, add `yaml` (eemeli/yaml) and use it alongside or in place of `js-yaml` for frontmatter round-tripping. Document the choice.

Tests: `vitest`, continuing the pattern from slices 1-2.

## What "done" looks like

Demo a full session from a clean state:

```bash
cd /tmp/slice3-test
git init
almanac init --name slice3-test

# Topic CRUD:
almanac topics create "Auth" --parent security
# (security doesn't exist — create it too, or refuse and tell user to create it first. Pick and document.)
almanac topics create "Security"
almanac topics create "Auth" --parent security
almanac topics create "JWT" --parent auth --parent security
almanac topics describe auth "Authentication + authorization"
almanac topics describe jwt "JWT session tokens"

almanac topics
# → auth (0 pages), security (0 pages), jwt (0 pages)

almanac topics show auth
# → Auth
# → Description: Authentication + authorization
# → Parents: security
# → Children: jwt
# → Pages: (none)

# Write a page:
cat > .almanac/pages/jwt-vs-sessions.md << 'EOF'
---
title: JWT vs Sessions
topics: [jwt, decisions]
---
# JWT vs Sessions

We chose JWT because [[src/auth/jwt.ts]] integrates with [[nextjs-middleware]].
EOF

almanac tag jwt-vs-sessions auth
# → ✓ tagged jwt-vs-sessions with auth (jwt already present, decisions already present)

almanac topics show auth
# → Pages: jwt-vs-sessions

almanac topics show auth --descendants
# → Pages: jwt-vs-sessions  (via auth → jwt)

# Rename:
almanac topics rename jwt session-tokens
# → ✓ renamed jwt → session-tokens (1 page updated)

cat .almanac/pages/jwt-vs-sessions.md | head -4
# → topics: [session-tokens, decisions, auth]

# Cycle prevention:
almanac topics link auth session-tokens
# → error: adding auth as parent of session-tokens would create a cycle
#   (session-tokens → auth (parent) ... → auth would become ancestor of itself)

# Delete:
almanac topics delete decisions
# → ✓ deleted topic decisions (1 page untagged)

# Tag via stdin:
almanac search --orphan | almanac tag --stdin auth
# → (no orphans, no-op)

# Health:
almanac health
# → orphans (0): (ok)
# → stale (0): (ok)
# → dead-refs (2): jwt-vs-sessions references src/auth/jwt.ts (missing); ...
# → broken-links (1): jwt-vs-sessions → nextjs-middleware (target does not exist)
# → empty-topics (0): (ok)
# → empty-pages (0): (ok)
# → slug-collisions (0): (ok)

almanac health --json > /tmp/report.json
# → structured JSON

almanac health --topic auth
# → (scoped to pages under auth + its descendants)

# Untag:
almanac untag jwt-vs-sessions session-tokens
# → ✓ untagged (now orphan for session-tokens)

almanac health
# → orphans (0): still has auth, decisions gone — wait, decisions was deleted. Has auth. Still not orphan.
```

All commands succeed. Type check clean. Tests pass.

## Testing

- Topic CRUD round-trips `.almanac/topics.yaml`
- Cycle detection refuses `link` that would create a cycle, including multi-hop cycles
- `--descendants` traverses the DAG correctly
- Tag / untag mutates page frontmatter without touching body, preserves other frontmatter fields
- `rename` rewrites every affected page and is atomic per page
- `delete` untags every affected page, preserves unrelated topics
- Health detects each category independently; produces accurate counts
- Health `--topic` scopes correctly through DAG descendants
- `empty-pages` detection: a page with only frontmatter + heading is empty; with a paragraph it's not
- Slug collision detection via rescan

Run `npm test` + `npm run build` + a manual dry-run of the demo above before committing.

## Design rules (non-negotiable)

- **CLI never touches AI.** Slice 3 is pure query + mutation against DB + page frontmatter + topics.yaml. No `claude-agent-sdk` imports.
- **Page body is sacred.** Tag/untag commands touch only frontmatter; body bytes unchanged.
- **Topic metadata has a single source of truth: `.almanac/topics.yaml`.** SQLite `topics` table is derived.
- **Silent by default.** Successful commands print one-line confirmations; errors go to stderr with exit code 1.
- **`--json` output is machine-parseable JSON** (no console formatting, no ANSI codes).
- **Cycle prevention depth cap at 32.** Belt and suspenders alongside CHECK constraint.

## Commit template

```
feat(slice-3): topics DAG + tag/untag + health report

- .almanac/topics.yaml as source of truth for topic metadata (title,
  description, parents)
- almanac topics: list/show/create/link/unlink/rename/delete/describe
- Cycle detection on link (depth-capped recursive CTE)
- almanac tag/untag: frontmatter-preserving page mutation, atomic per file
- almanac health: 8 report categories, pretty + JSON output, --topic scope
- Reindexer reads topics.yaml on rebuild; ad-hoc topic slugs still indexed
```

Push to origin/main.

## Report format

1. What was built (files + commands)
2. `npm test` output
3. Manual verification transcript (the demo above)
4. Git commit hash + push confirmation
5. Judgment calls + open questions

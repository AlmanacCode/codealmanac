# codealmanac — full reference

Long-form manual for the `almanac` / `codealmanac` CLI. The mini guide at `~/.claude/codealmanac.md` covers *when* to reach for each command; this covers *every flag, every return shape, every edge case*. Import with `@~/.claude/codealmanac-reference.md` on demand.

Groupings match `almanac --help`:

1. **Query** — `search`, `show`, `path`, `info`, `topics`, `health`
2. **Edit** — `tag`, `untag`, `topics create|link|unlink|rename|delete|describe`, `reindex`
3. **Wiki lifecycle** — `init`, `list`, `bootstrap`, `capture`
4. **Install** — `hook install|uninstall|status`

Every command auto-registers the current repo in `~/.almanac/registry.json` on first run. Exceptions: `init` (registers explicitly) and `list --drop` (skips auto-register so the removal intent isn't undone).

---

## 1. Full command matrix

### 1.1 Query

#### `almanac search [query]`

| Flag | Type | Default | Semantics |
|---|---|---|---|
| `[query]` | string | — | FTS5 MATCH against titles + bodies. Omit for pure-filter queries. |
| `--topic <name...>` | repeatable | `[]` | AND-intersect filter. Walks the DAG subtree — `--topic auth` matches `auth` or any descendant. |
| `--mentions <path>` | string | — | Pages referencing this file (no trailing `/`) or folder (trailing `/`). Matches both `files:` frontmatter and `[[...]]` file refs, case-insensitive. |
| `--since <duration>` | duration | — | Updated within window. Format: `<int>[smhdw]` (`2w`, `30d`, `48h`). By file mtime. |
| `--stale <duration>` | duration | — | Inverse of `--since`. |
| `--orphan` | bool | false | Pages with zero topics. |
| `--include-archive` | bool | false | Include archived pages. |
| `--archived` | bool | false | Archived pages only. |
| `--wiki <name>` | string | current repo | Target a specific registered wiki. |
| `--json` | bool | false | Structured JSON. |
| `--limit <n>` | int ≥0 | unbounded | Cap results. |

**Default output:** one slug per line to stdout.
**`--json` schema:** `{wiki, results: [{slug, title, updated_at, topics, path}]}`.
**Exit:** `0` always (empty result isn't an error). `2` on flag validation failure.

#### `almanac show [slug]`

| Flag | Semantics |
|---|---|
| `[slug]` | Required unless `--stdin`. Slugs are kebab-canonicalized before lookup. |
| `--stdin` | Read slugs from stdin. Pages separated by form-feed (`\f`) in output. |
| `--wiki <name>` | Target a specific registered wiki. |

Projections (if available in the installed build — check `--help`): `--raw` (body only), `--meta` (metadata only), `--lead` (first paragraph), `--backlinks` (pages linking in), `--links` (pages this links out to). Falls back to `almanac info` + `path` if missing.

**Exit:** `0` on success, `1` if slug not found, `2` on flag errors.

#### `almanac path [slug]`

Resolve slug → absolute file path. `--stdin` writes one path per input line, preserving order; missing slugs emit a blank line so output is 1:1.

#### `almanac info [slug]`

Metadata only (topics, refs, links, lineage). No body.

**`--json` schema:**
```json
{
  "slug": "checkout-flow",
  "title": "...",
  "updated_at": 1713000000,
  "archived_at": null,
  "superseded_by": null, "supersedes": null,
  "topics": [...],
  "files": [...],
  "wikilinks_out": [...],
  "wikilinks_in": [...],
  "file_refs": [{"path": "...", "is_dir": false}],
  "cross_wiki_refs": [{"wiki": "...", "target": "..."}]
}
```

#### `almanac topics` (and subcommands)

`almanac topics` — list all with page counts. `--json` emits `[{slug, description, parents[], children[], page_count}]`.

`almanac topics show <slug>` — description, parents, children, pages. `--descendants` includes pages tagged with descendant topics (walks the DAG subtree).

#### `almanac health`

Eight independent categories. One failing doesn't skip the others.

| Flag | Default | Semantics |
|---|---|---|
| `--topic <name>` | — | Scope page-level checks to the topic + descendants. Scopes topic-level checks to the subtree. |
| `--stale <duration>` | `90d` | Threshold for the `stale` category. |
| `--stdin` | false | Restrict page-level checks to slugs from stdin. Intersects with `--topic`. |
| `--json` | false | Structured JSON. |
| `--wiki <name>` | current repo | Target a specific registered wiki. |

**Categories:** `orphans`, `stale`, `dead-refs`, `broken-links`, `broken-xwiki`, `empty-topics`, `empty-pages`, `slug-collisions`. Archived pages are exempt from most (see §4). Exit `0` always — the report IS the output.

### 1.2 Edit

#### `almanac tag [page] [topics...]`

Add topics to a page. Auto-creates missing topics. Idempotent. Rewrites only the frontmatter block; body bytes preserved. `--stdin` tags every page-slug from stdin with the same topic set — in that mode all positionals are topics.

#### `almanac untag <page> <topic>`

Remove one topic. Idempotent (silent 0 if page wasn't tagged).

#### `almanac topics create <name>`

`--parent <slug>` repeatable. Rejects if any parent slug doesn't exist.

#### `almanac topics link <child> <parent>` / `topics unlink <child> <parent>`

Add/remove a DAG edge. `link` is cycle-checked (§5). `unlink` is idempotent.

#### `almanac topics rename <old> <new>`

Rewrites `topics.yaml` first (atomic tmp+rename), then every affected page's `topics:` frontmatter. YAML-first so a mid-pass crash leaves the graph, not the pages, as the source of truth.

#### `almanac topics delete <slug>`

Removes from `topics.yaml`, untags every affected page. Does **not** cascade to children — orphaned children become top-level. Run `almanac health` to surface stragglers.

#### `almanac topics describe <slug> <text>`

Set the topic's one-line description in `topics.yaml`.

#### `almanac reindex`

Forces a full rebuild of `.almanac/index.db`. Rarely needed — every query calls `ensureFreshIndex` first. Use after manual `topics.yaml` edits or when clock skew defeats mtime checks.

### 1.3 Wiki lifecycle

#### `almanac init`

Scaffolds `.almanac/` in cwd. `--name <name>` sets the registry entry (default: basename of cwd). `--description <text>` stored in the registry. Creates `pages/`, `topics.yaml`, `README.md`, `index.db`, and adds `.gitignore` entries.

#### `almanac list`

`--json` for structured output. `--drop <name>` is the **only** way to remove a registry entry.

#### `almanac bootstrap`

Spawn an agent to create initial wiki stubs. Requires `ANTHROPIC_API_KEY`. `--quiet` suppresses per-tool streaming. `--model <model>` overrides the model. `--force` overwrites a populated wiki. Writes `.almanac/.bootstrap-<timestamp>.log`.

#### `almanac capture [transcript]`

Capture knowledge from a Claude Code session transcript. Requires `ANTHROPIC_API_KEY` or a logged-in Claude Code session. Refuses if no `.almanac/` exists — capture maintains wikis, doesn't create them.

**Transcript resolution order:** explicit positional → `--session <id>` matches filename under `~/.claude/projects/` → most recent transcript whose recorded `cwd` matches this repo.

Writes SDK transcript to `.almanac/.capture-<session-id>.log`. A writer subagent drafts pages; a reviewer subagent enforces notability + writing conventions (§9) before drafts land.

### 1.4 Install

#### `almanac hook install | uninstall | status`

See §7 — the hook is complex enough to warrant its own section.

### 1.5 `--stdin` pipe semantics

Commands that accept `--stdin`: `show`, `path`, `info`, `tag`, `health`.

- One slug per line; blank lines ignored; whitespace trimmed.
- Output order mirrors input order (matters for `path`, `info`).
- Missing slugs don't abort — logged to stderr, pipeline continues. `show --stdin` writes a "not found" marker and keeps exit `0` for pipeline resilience; `path` / `info` exit `1` overall if any slug was missing.
- `--stdin` must be explicit. No `isTTY` auto-detection (confusing under script redirection).

---

## 2. The unified `[[...]]` classifier

One syntax, four kinds. Rules applied in order:

1. **`:` before any `/`** → cross-wiki (`[[wiki:slug]]`)
2. **Contains `/`** → file (no trailing `/`) or folder (trailing `/`)
3. **Otherwise** → page slug wikilink

| Input | Classified | Why |
|---|---|---|
| `[[a:b/c]]` | xwiki `a`→`b/c` | colon before slash, rule 1 |
| `[[src/a:b]]` | file `src/a:b` | slash before colon, rule 2 |
| `[[./x]]` | file `x` | normalized; `./` stripped |
| `[[src/checkout/]]` | folder | trailing `/` |
| `[[foo\|display]]` | page `foo` | Obsidian pipe stripped |
| `[[  ]]` | null | empty after trim |

**Paths with spaces** are allowed. **GLOB metacharacters** like `[id]`, `[...slug]`, `{a,b}`, `*` are stored literally — they're Next.js-style dynamic segments, not glob expressions.

**Case sensitivity:** the indexer stores two forms per file/folder ref:
- `path` — lowercased, used for `--mentions` lookups (search is case-insensitive).
- `original_path` — as-written, used for filesystem `stat` in `health dead-refs` so case-sensitive filesystems (Linux, some Docker images) don't false-negative.

**Broken links** are recorded anyway (`wikilinks` table keeps the row), then surfaced by `health --broken-links`. Reindex is non-validating by design.

Cross-wiki refs live in their own table (`cross_wiki_links`), never lowercased.

---

## 3. Frontmatter schema

| Field | Type | Default | Purpose |
|---|---|---|---|
| `title` | string | H1 fallback | Display title. Missing → first H1 in body. |
| `topics` | string[] | `[]` | DAG tags. Kebab-cased on ingest; duplicates collapsed. |
| `files` | string[] | `[]` | File/folder paths this page documents. Load-bearing for `--mentions`. Trailing `/` = folder. |
| `archived_at` | date / ISO string / epoch seconds | `null` | Non-null → excluded from default search. See §4. |
| `superseded_by` | slug | `null` | For archived pages: the active replacement. |
| `supersedes` | slug | `null` | For active pages: the archived predecessor. |

**Normalization:** YAML `Date` → epoch seconds; ISO string → `Date.parse`; raw number → `Math.floor`. Unrecognizable `archived_at` → `null` (page stays active; safer default). Unknown frontmatter fields tolerated silently. Malformed YAML → one-line stderr warning, treated as no frontmatter; the reindex keeps going.

**Full example:**

```markdown
---
title: Checkout flow
topics: [flows, payments]
files:
  - src/checkout/handler.ts
  - src/checkout/
  - docker-compose.yml
archived_at: null
---

# Checkout flow

The flow starts at `src/checkout/handler.ts` when the browser POSTs
`/api/cart/submit`. The handler creates a Stripe PaymentIntent, writes an
inventory lock row to Supabase, returns the PI client secret. See
[[inventory-lock-gotcha]] for the deadlock we hit in March.
```

---

## 4. Archive / lineage

Pages evolve in place. **Edit the existing page** when facts change — git history is the archive.

**Archive + supersede** is reserved for **fundamental reversals**: a central decision overturned, a system replaced wholesale, an incident re-opened.

**The test:** *is this an update to the old state, or a reversal of a central decision?* Update → edit. Reversal → archive + successor.

### Frontmatter shapes

Archived page:
```yaml
---
title: JWT sessions (archived)
topics: [auth, decisions]
archived_at: 2026-03-15
superseded_by: server-sessions
---
```

Successor:
```yaml
---
title: Server sessions
topics: [auth, decisions]
supersedes: jwt-sessions
files: [src/auth/session.ts, src/auth/middleware.ts]
---
```

Both files exist on disk. Both are indexed.

### Search scoping

- Default: active only.
- `--include-archive`: active + archived.
- `--archived`: archived only. Useful for retrospectives.

### Health exemptions for archived pages

Archived pages (as *source*) are exempt from `orphans`, `stale`, `dead-refs`, `broken-links`, `broken-xwiki`, `empty-pages`. Rationale: a retired page legitimately references retired files, has no need to be "kept fresh," and minimal stubs are fine.

Archived pages ARE still valid *targets* of broken-link checks — an active page linking to an archived page is fine (target exists); an active page linking to a slug with no file at all is flagged regardless.

---

## 5. DAG model and traversal

Topics form a DAG: each topic has zero or more parents; each page has zero or more topics. Structure in `.almanac/topics.yaml`, assignment in page frontmatter.

```yaml
# topics.yaml
topics:
  auth:
    description: authentication, sessions, identity
    parents: []
  jwt:
    parents: [auth]
  sessions:
    parents: [auth]
  checkout:
    parents: [flows, payments]   # multi-parent
```

**`--descendants`** walks the subtree rooted at the given topic. `almanac topics show auth --descendants` includes `auth`, `jwt`, `sessions`, and any page tagged with any of them. `almanac search --topic auth` applies the same walk implicitly.

### Cycle prevention

Three layers:
1. **CHECK constraint** on `topic_parents` blocks self-loops (`child = parent`).
2. **Pre-insert traversal** walks parents upward before committing; refuses if `child` is reachable.
3. **Depth cap of 32** bails the traversal defensively. Real topic DAGs are ≤4 deep.

`almanac topics link A B` where A is already an ancestor of B fails: `almanac: link would create cycle: A → … → B → A`.

### Rename / delete side effects

`topics rename old new`:
1. Rewrite `topics.yaml` atomically (tmp + rename). New key written, old removed, parent edges migrated.
2. Rewrite every page whose `topics:` contains `old`. Body bytes preserved.
3. Reindex fires automatically on `topics.yaml` mtime bump.

YAML-first order matters: if pages rewrote first and crashed midway, `topics.yaml` would describe an invalid state. YAML-first gives a clean rollback point.

`topics delete slug`:
1. Remove from `topics.yaml`.
2. Untag every affected page.
3. **Does not cascade.** Children of the deleted topic become top-level. Run `almanac health --empty-topics` and re-parent or prune.

---

## 6. Shell-piping cookbook

Every command emits slugs one-per-line, so they compose.

**Find stale pages in a topic and tag them `review-needed`:**
```bash
almanac search --topic auth --stale 90d \
  | almanac tag --stdin review-needed
```

**Find pages referencing a just-deleted file:**
```bash
almanac search --mentions src/legacy/oauth.ts --include-archive
```

**Bulk move pages from an old topic to a new one:**
```bash
almanac topics create payments-v2 --parent payments
almanac search --topic old-payments | almanac tag --stdin payments-v2
almanac topics delete old-payments
```

**List pages that lack `files:` frontmatter for files they mention in prose:**
```bash
almanac search | while read slug; do
  info=$(almanac info "$slug" --json)
  prose=$(echo "$info" | jq -r '.file_refs[].path' | sort -u)
  fm=$(echo "$info" | jq -r '.files[]' | sort -u)
  missing=$(comm -23 <(echo "$prose") <(echo "$fm"))
  [ -n "$missing" ] && { echo "$slug:"; echo "$missing" | sed 's/^/  /'; }
done
```

**Open every orphan page in `$EDITOR`:**
```bash
almanac search --orphan | almanac path --stdin | xargs -n 1 "$EDITOR"
```

---

## 7. The capture hook

### Trigger

Claude Code invokes `SessionEnd` hooks after each session. Payload on stdin:
```json
{ "session_id": "uuid", "transcript_path": "/abs/path.jsonl", "cwd": "/abs/repo/path" }
```

### What `hooks/almanac-capture.sh` does

1. Parse payload with `jq`. Missing `jq` → exit 0 silently.
2. Walk upward from `cwd` for a `.almanac/`. Bounded at filesystem root.
3. Background `almanac capture "$TRANSCRIPT" --session "$SESSION_ID" --quiet`, redirect to `.almanac/.capture-$SESSION_ID.log`, `disown`.
4. Exit always `0`. Capture failures must never break Claude Code's session-end path.

Falls back to `npx --no-install codealmanac` if `almanac` isn't on `PATH`.

### `hook install | uninstall | status`

**`install`:**
- **Idempotent.** Twice → one entry, not two.
- **Refuses foreign `SessionEnd` entries** whose command doesn't end with `almanac-capture.sh`. Prints them, exits `1`. Users wire their own hooks (notifications, autocommit); we don't clobber.
- **Replaces stale almanac entries** — same filename, different absolute path (old install in a different `node_modules`).
- **Atomic** tmp + rename. Claude Code never sees a partial `settings.json`.

**`uninstall`:**
- Removes only entries whose command ends in `almanac-capture.sh`. Foreign entries stay.
- Drops `hooks.SessionEnd` if empty, then `hooks` if empty. File returns to pre-install shape.

**`status`:**
- Reports installed / not installed, the script path, the settings path. Non-interactive.

### Diagnosing "capture didn't run"

```bash
almanac hook status                      # installed?
ls -lah .almanac/.capture-*.log          # any logs at all?
```

Installed but no log: `SessionEnd` didn't fire (rare, hard crash), or script bailed before backgrounding (add `set -x` to trace), or no `.almanac/` upward from `cwd` (silent correct no-op).

### Diagnosing "capture ran but wrote nothing"

```bash
tail -200 .almanac/.capture-<id>.log
```

Common causes:
- `ANTHROPIC_API_KEY` not in the hook's environment. Claude Code's hook env is minimal; `~/.zshrc` is NOT sourced. Export via `~/.claude/settings.json`'s `env` key, or rely on `claude auth` OAuth credentials.
- Transcript path didn't resolve. Capture prints resolution status early.
- Reviewer rejected the draft for notability — rationale is in the log.
- Session was pure-read with no decisions or discoveries. Correct no-op.

---

## 8. Multi-wiki model

### Registry at `~/.almanac/registry.json`

```json
{
  "wikis": [
    { "name": "openalmanac", "path": "/Users/me/code/openalmanac", "description": "…" },
    { "name": "codealmanac", "path": "/Users/me/code/codealmanac" }
  ]
}
```

### Registration paths

- **`almanac init`** — explicit. Sets `name` and `description`.
- **Silent auto-register** — every other command (except `list --drop`) calls `autoRegisterIfNeeded` on cwd. Repo with `.almanac/` but no registry entry → added with `name = basename(cwd)`, no description. Makes "cloned a repo with `.almanac/` committed" just work.
- **`almanac list --drop <name>`** — the only removal path. Skips auto-register so the removal isn't immediately undone.

### `--wiki <name>`

Route the command at a specific registered wiki. Used when you're in one repo but querying another. Without `--wiki`, commands resolve to the wiki whose `path` is an ancestor of cwd. If none, commands error: `almanac: no wiki registered for this cwd. run 'almanac init' or pass --wiki.`

### Cross-wiki link resolution

`[[wiki:slug]]` → `{kind: "xwiki", wiki, target}` → row in `cross_wiki_links`. `health --broken-xwiki` checks: is `wiki` in the registry and does its `path` contain `.almanac/`? Currently does NOT descend into the target wiki's index to confirm the slug exists — deferred.

### Unreachable targets

- Searches silently skip.
- `health --broken-xwiki` reports them.
- `show --wiki unreachable` exits `1` with a diagnostic.

---

## 9. Notability and writing conventions

The reviewer subagent enforces these during capture. Applying them yourself reduces rework.

### Patterns to avoid (bad → good)

**Significance inflation.**
- Bad: `The Stripe integration serves as a testament to our commitment to payment reliability.`
- Good: `The Stripe integration handles card payments. PaymentIntent is created at cart-submit; webhook confirmation completes the order.`

**Interpretive -ing clauses.**
- Bad: `The team migrated to async webhooks, highlighting their pragmatic approach.`
- Good: `The team migrated to async webhooks in March 2026 after the inventory-lock deadlock.`

**Vague attribution.**
- Bad: `Experts argue JWTs are unsuitable for sessions.`
- Good: `We moved off JWTs to server sessions in 2025 because refresh-token rotation required server state anyway.`

**Promotional language.**
- Bad: `Our groundbreaking approach delivers vibrant performance.`
- Good: `Rate limiting: sliding-window counter in Redis, 100 req / user / minute, in src/middleware/rate-limit.ts.`

**Hedging.**
- Bad: `While details are limited, it appears the cache might use LRU eviction.`
- Good: confirm from code, or cut the sentence.

**Empty evaluative sentences.** `This architecture is elegant and powerful.` → cut.

**Formulaic conclusions.** `In conclusion, the checkout flow demonstrates careful engineering.` → cut. Pages don't need conclusions.

### The four page shapes

**Entity** (a thing we depend on):
```yaml
---
title: Supabase
topics: [stack, database]
files: [src/lib/supabase.ts, backend/src/models/, docker-compose.yml]
---

# Supabase

PostgreSQL hosted on Supabase. Connection pooling via Supavisor. Client
singleton in src/lib/supabase.ts; backend models in backend/src/models/
use SQLAlchemy against the same DATABASE_URL (Doppler-managed).
```

**Decision** (a choice with tradeoffs):
```yaml
---
title: Server sessions (not JWTs)
topics: [auth, decisions]
supersedes: jwt-sessions
files: [src/auth/session.ts, src/auth/middleware.ts]
---

# Server sessions

We use server-side sessions, not JWTs. Session state lives in Redis, keyed
by a rotating cookie. Chosen because refresh-token rotation already required
server state for the revocation list, removing the main perceived benefit
of stateless JWTs.
```

**Flow** (a multi-file process):
```yaml
---
title: Checkout flow
topics: [flows, payments]
files: [src/checkout/, src/api/cart/submit.ts, backend/src/services/orders.py]
---

# Checkout flow

The browser POSTs /api/cart/submit. The handler creates a Stripe
PaymentIntent and an inventory lock row in orders (status=pending). Client
confirms the PaymentIntent. Stripe's webhook flips status=paid and releases
the lock.
```

**Gotcha** (something that bit us):
```yaml
---
title: Inventory-lock deadlock
topics: [gotchas, payments]
files: [backend/src/services/orders.py]
---

# Inventory-lock deadlock

Before March 2026, the Stripe webhook acquired the same row lock the
checkout path held. When Stripe retried a delayed webhook during a new
checkout for the same SKU, the two transactions deadlocked; Postgres killed
one, usually the webhook, leaving orders silently stuck in pending.
```

### General principles

- Every sentence contains a specific fact. If the sentence could describe any codebase, cut it.
- Neutral tone. `is`, not `serves as`.
- No speculation. "I don't know why X" is fine as an explicit note; a guess is not.
- Prose first. Bullets for genuine lists. Tables for structured comparison only.
- Reference code with `[[...]]`. Inline mentions are fine but only `[[...]]` gets indexed.
- List files in frontmatter. Pages about specific code need `files: [...]` to surface in `--mentions`.

---

## 10. Troubleshooting

### "dead-refs reports files that exist"
Case sensitivity on Linux. Schema v2 stores `original_path` for case-preserving stat; upgrade from pre-v2 requires `almanac reindex`. Dangling symlinks fail `existsSync` too.

### "pages don't show up in `--mentions`"
Missing `files:` frontmatter, OR path referenced only in inline prose (not via `[[...]]`). Inline prose isn't indexed. If neither: `almanac reindex`.

### "topics missing after rename"
`topics rename` bumps `topics.yaml` mtime → next query's `ensureFreshIndex` catches up. Hand-edited `topics.yaml` without page rewrites leaves frontmatter out of sync — `almanac reindex` then audit with `almanac health --orphans --empty-topics`.

### "capture didn't fire"
```bash
almanac hook status
claude auth status                  # OAuth token present?
echo "${ANTHROPIC_API_KEY:0:10}"    # API key fallback?
ls -lah .almanac/.capture-*.log
```
No logs at all → script bailed pre-background. Add `set -x` to `hooks/almanac-capture.sh` to trace.

### "slug collision warnings"
Two files kebab-case to the same slug (`Checkout Flow.md` and `checkout-flow.md`). `health --slug-collisions` lists them. Rename one, grep `.almanac/pages/` for any `[[...]]` references, update them.

### "better-sqlite3 bindings missing"
Node version / arch mismatch with the prebuilt binary. `npm rebuild better-sqlite3`. On M-series Macs with x64+arm64 Node installs, bindings are arch-specific — rebuild in the arch you'll run from. Node ≥20 required (`engines.node`).

### Forensics files
- `.almanac/.capture-<session-id>.log` — per-session SDK transcript from capture. Writer + reviewer interleaved.
- `.almanac/.bootstrap-<timestamp>.log` — one per bootstrap. Gitignored by default.

---

## When in doubt

- `almanac --help` / `almanac <command> --help` — flags are always current for the installed build.
- `.almanac/README.md` in the repo — the notability bar and topic taxonomy for *this* repo override anything here.

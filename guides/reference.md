# codealmanac — full reference

Long-form manual for the `almanac` / `codealmanac` CLI. The mini guide at `~/.claude/codealmanac.md` covers *when* to reach for each command; this covers *every flag, every return shape, every edge case*. Import with `@~/.claude/codealmanac-reference.md` on demand.

Groupings match `almanac --help`:

1. **Query** — `search`, `show`, `health`, `list`
2. **Edit** — `tag`, `untag`, `topics ...`
3. **Wiki lifecycle** — `bootstrap`, `capture`, `hook ...`, `reindex`
4. **Setup** — `setup`, `uninstall`, `doctor`, `update`

Every query/edit command auto-registers the current repo in `~/.almanac/registry.json` on first run. Exceptions: `list --drop` (skips auto-register so the removal intent isn't undone) and the setup group (installers, not wiki commands — they never touch the registry).

There is no `almanac init` command. The two ways a wiki gets scaffolded are `almanac bootstrap` (agent reads the repo and seeds stub pages) and committing a `.almanac/` that someone else authored and cloning into it (auto-registered on first query command).

---

## 1. Full command matrix

### 1.1 Query

#### `almanac search [query]`

| Flag | Type | Default | Semantics |
|---|---|---|---|
| `[query]` | string | — | FTS5 MATCH against titles + bodies. Omit for pure-filter queries. |
| `--topic <name...>` | repeatable | `[]` | AND-intersect filter. Walks the DAG subtree — `--topic auth` matches `auth` or any descendant. |
| `--mentions <path>` | string | — | Pages referencing this path. Matches exact file, trailing-slash folders, and any file under a folder prefix. Case-insensitive. |
| `--since <duration>` | duration | — | Updated within window. Format: `<int>[smhdw]` (`2w`, `30d`, `48h`). By file mtime. |
| `--stale <duration>` | duration | — | Inverse of `--since`. |
| `--orphan` | bool | false | Pages with zero topics. |
| `--include-archive` | bool | false | Include archived pages. |
| `--archived` | bool | false | Archived pages only. |
| `--wiki <name>` | string | current repo | Target a specific registered wiki. |
| `--json` | bool | false | Structured JSON. |
| `--limit <n>` | int ≥0 | unbounded | Cap results. |

**Default output:** one slug per line to stdout. When zero pages match, stdout is empty and stderr emits `# 0 results` (a breadcrumb so users can tell "matched nothing" apart from "command broken"). `--json` is silent on stderr — `[]` is the unambiguous empty signal there.
**`--json` schema:** JSON array of `{slug, title, updated_at, archived_at, superseded_by, topics}`. `title` is the page's frontmatter title (nullable when no frontmatter). `updated_at` is epoch seconds (file mtime). `archived_at` is epoch seconds or `null`. `superseded_by` is a slug string or `null`. `topics` is an array of topic slugs, sorted ascending. No `path` field — use `almanac show <slug> --path` (or `--json`) for the absolute path.
**Exit:** `0` always (empty result isn't an error). Arg-parse failures exit `1` with an `almanac:` error.

#### `almanac show [slug]`

Unified reader. Absorbs the old `info` and `path` commands — pick fields with flags.

| Flag | Default | Semantics |
|---|---|---|
| `[slug]` | — | Required unless `--stdin`. Slugs are kebab-canonicalized before lookup. |
| `--stdin` | false | Read slugs from stdin, one per line. JSON Lines output for `--json` mode. |
| `--wiki <name>` | current repo | Target a specific registered wiki. |
| `--json` | false | Structured JSON. Overrides every view/field flag. |
| `--body` | false | Body only. Guarantees exactly one trailing newline — shell redirect produces a well-formed file. |
| `--raw` | false | Deprecated alias for `--body`; still accepted for compatibility. |
| `--meta` | false | Metadata header only, no body. |
| `--lead` | false | First paragraph of the body only (cheap preview). |
| `--title` | false | Print title. |
| `--topics` | false | Print topics. |
| `--files` | false | Print file refs. |
| `--links` | false | Print outgoing wikilinks. |
| `--backlinks` | false | Print incoming wikilinks. |
| `--xwiki` | false | Print cross-wiki links. |
| `--lineage` | false | Print `archived_at` / `supersedes` / `superseded_by`. |
| `--updated` | false | Print updated timestamp. |
| `--path` | false | Print absolute file path (`info` + `path` replacement). |

Combining field flags emits labeled sections in canonical order. `--meta` is the full labeled header; individual flags like `--title --topics` give you just those two sections.

**Exit:** `0` on success, `1` if slug not found, non-zero on flag/input errors.

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

#### `almanac list`

| Flag | Semantics |
|---|---|
| `--json` | Structured JSON. |
| `--drop <name>` | Remove a wiki from the registry. The **only** way entries are ever removed. Skips auto-register. |

### 1.2 Edit

#### `almanac tag [page] [topics...]`

Add topics to a page. Auto-creates missing topics. Idempotent. Rewrites only the frontmatter block; body bytes preserved. `--stdin` tags every page-slug from stdin with the same topic set — in that mode all positionals are topics.

Flags: `--stdin`, `--wiki <name>`.

#### `almanac untag <page> <topic>`

Remove one topic. Idempotent (silent `0` if page wasn't tagged).

Flags: `--wiki <name>`.

#### `almanac topics` (DAG management)

- `almanac topics list` — list all topics with page counts. `--json` emits an array of `{slug, title, description, page_count}`. `page_count` excludes archived pages (matches `topics show`). `parents`/`children` are only on `topics show <slug> --json`; use that when you need DAG edges.
- `almanac topics show <slug>` — description, parents, children, pages. `--descendants` includes pages tagged with descendant topics (walks the DAG subtree).
- `almanac topics create <name>` — `--parent <slug>` repeatable. Rejects if any parent slug doesn't exist.
- `almanac topics link <child> <parent>` / `almanac topics unlink <child> <parent>` — add/remove a DAG edge. `link` is cycle-checked (§5). `unlink` is idempotent.
- `almanac topics rename <old> <new>` — rewrites `topics.yaml` first (atomic tmp+rename), then every affected page's `topics:` frontmatter. YAML-first so a mid-pass crash leaves the graph, not the pages, as the source of truth.
- `almanac topics delete <slug>` — removes from `topics.yaml`, untags every affected page. Does **not** cascade to children — orphaned children become top-level. Run `almanac health` to surface stragglers.
- `almanac topics describe <slug> <text>` — set the topic's one-line description.

All topic subcommands accept `--wiki <name>`. `list` / `show` accept `--json`.

### 1.3 Wiki lifecycle

#### `almanac bootstrap`

Spawns an agent to create initial wiki stubs. Requires the selected provider to be installed and logged in. `--quiet` suppresses per-tool streaming. `--agent <provider>` overrides the provider for this run. `--model <model>` overrides the provider-local model. `--json` emits a structured `CommandOutcome` and suppresses streaming. `--force` overwrites an existing populated wiki. Writes `.almanac/logs/.bootstrap-<timestamp>.log`.

Bootstrap is the scaffolding path — it creates `.almanac/pages/`, `.almanac/topics.yaml`, `.almanac/README.md`, and stub entity pages based on what the agent reads in the repo.

#### `almanac capture [transcript]`

Run the writer/reviewer pipeline on a Claude Code session transcript. Usually automatic — the `SessionEnd` hook invokes this. Refuses if no `.almanac/` exists in cwd or any parent (capture maintains wikis, doesn't create them; run `almanac bootstrap` first).

| Flag | Semantics |
|---|---|
| `[transcript]` | Explicit path. Falls back to `--session` match or most-recent-by-cwd. |
| `--session <id>` | Target a specific session by ID. Matches filename under `~/.claude/projects/`. |
| `--quiet` | Suppress per-tool streaming; print only the final summary. |
| `--agent <provider>` | Override the configured provider for this run. |
| `--model <model>` | Override the agent model. |
| `--json` | Emit a structured `CommandOutcome`; suppresses streaming so stdout is parseable. |

Writes SDK transcript to `.almanac/logs/.capture-<session-id>.jsonl` (one JSON message per line). When invoked manually without `--session`, falls back to `.capture-<timestamp>.jsonl` so repeated runs don't clobber each other. A writer subagent drafts pages; a reviewer subagent enforces notability + writing conventions (§9) before drafts land.

#### `almanac hook install | uninstall | status`

See §7 — the hook is complex enough to warrant its own section.

#### `almanac reindex`

Forces a full rebuild of `.almanac/index.db`. Rarely needed — every query calls `ensureFreshIndex` first. Use after manual `topics.yaml` edits or when clock skew defeats mtime checks.

Flag: `--wiki <name>`.

### 1.4 Setup

#### `almanac setup` (alias: bare `codealmanac`)

Install the SessionEnd hook + the two CLAUDE.md guides (`codealmanac.md`, `codealmanac-reference.md`) + the `@~/.claude/codealmanac.md` import line. Idempotent.

| Flag | Semantics |
|---|---|
| `-y, --yes` | Skip prompts; install everything. |
| `--agent <agent>` | Set the default provider. Accepts `claude`, `codex`, `cursor`, or optional shorthand like `claude/opus`. |
| `--skip-hook` | Opt out of the SessionEnd hook. |
| `--skip-guides` | Opt out of the CLAUDE.md guides. |

Both `almanac setup` and bare `codealmanac` route here. `codealmanac --yes`, `codealmanac --skip-hook`, and `codealmanac --skip-guides` are the typical first-run invocations. Passing `--skip-hook --skip-guides` together short-circuits with a terse line — nothing was installed, no banner drawn.

#### `almanac uninstall`

Remove the hook + guides + import line.

| Flag | Semantics |
|---|---|
| `-y, --yes` | Skip confirmations; remove everything. |
| `--keep-hook` | Don't remove the SessionEnd hook (guides still prompted unless `--yes`). |
| `--keep-guides` | Don't remove the guides or CLAUDE.md import (hook still prompted unless `--yes`). |

#### `almanac doctor`

Read-only install + current-wiki health report. Every check reports a state; none of them mutate. Exit always `0` — doctor is a report, not a test.

| Flag | Semantics |
|---|---|
| `--json` | Structured JSON. |
| `--install-only` | Report only on the install (skip the wiki section). |
| `--wiki-only` | Report only on the current wiki (skip the install section). |

**JSON shape:**
```json
{
  "version": "0.1.3",
  "install": [
    { "key": "install.path",   "status": "ok", "message": "..." },
    { "key": "install.sqlite", "status": "ok", "message": "..." },
    { "key": "install.auth",   "status": "problem", "message": "...", "fix": "run: claude auth login --claudeai" },
    { "key": "install.hook",   "status": "ok", "message": "..." },
    { "key": "install.guides", "status": "ok", "message": "..." },
    { "key": "install.import", "status": "ok", "message": "..." }
  ],
  "agents": [
    {
      "id": "claude",
      "label": "Claude",
      "status": "ok",
      "readiness": "ready",
      "selected": true,
      "recommended": true,
      "installed": true,
      "authenticated": true,
      "model": "claude-sonnet-4-6",
      "providerDefaultModel": "claude-sonnet-4-6",
      "configuredModel": null,
      "account": "rohan@example.com",
      "detail": "rohan@example.com"
    }
  ],
  "wiki": [
    { "key": "wiki.repo",       "status": "info", "message": "repo: /abs/path" },
    { "key": "wiki.registered", "status": "ok",   "message": "registered as '...'" },
    { "key": "wiki.pages",      "status": "info", "message": "pages: 42" },
    { "key": "wiki.topics",     "status": "info", "message": "topics: 7" },
    { "key": "wiki.index",      "status": "info", "message": "index: rebuilt 2m ago" },
    { "key": "wiki.capture",    "status": "info", "message": "last capture: 1h ago (.capture-<id>.log)" },
    { "key": "wiki.health",     "status": "ok",   "message": "almanac health reports 0 problems" }
  ]
}
```

Each check has a stable `key` safe for scripting. ✗ entries include a `fix` field with a one-line "run: …" hint. Parse `--json` and count `status === "problem"` for a pass/fail gate.

The report also includes an `## Updates` section (`updates: Check[]` in `--json`) with keys `update.status`, `update.last_check`, `update.notifier`, and `update.dismissed`. `update.status === "problem"` when a new version is available — mirrors the pre-command banner.

#### `almanac agents`

Provider-focused settings and readiness.

```bash
almanac agents list
almanac agents doctor
almanac agents use claude
almanac agents model claude claude-opus-4-6
almanac agents model claude --default
```

`agents use` writes the default provider. `agents model` writes the provider-local model override; `--default`, `default`, or `null` resets the provider to its own default. The older `almanac set default-agent ...` and `almanac set model ...` commands remain compatibility aliases and print deprecation warnings.

`bootstrap` and `capture` resolve provider settings in this order:

```text
--agent flag > ALMANAC_AGENT env > config.agent.default > built-in default
--model flag > ALMANAC_MODEL env > config.agent.models[provider] > provider default
```

#### `almanac config`

Low-level scriptable settings surface.

```bash
almanac config list
almanac config list --show-origin
almanac config get agent.default
almanac config set agent.models.claude claude-opus-4-6
almanac config unset agent.models.claude
```

Supported keys: `update_notifier`, `agent.default`, `agent.models.claude`, `agent.models.codex`, and `agent.models.cursor`.

#### `almanac update`

Upgrade command + the controls for the nag banner. See §11 for the full update-notifier architecture.

| Flag | Semantics |
|---|---|
| (none) | Run `npm i -g codealmanac@latest` synchronously in the foreground. Inherits stdio so you see npm's progress bar, permission prompts, and peer-dep warnings verbatim. |
| `--dismiss` | Mark the current `latest_version` as "don't nag". No install. Banner is suppressed until a newer version ships. |
| `--check` | Force a registry query now, bypassing the 24h cache. Prints the result. No install. |
| `--enable-notifier` | Deprecated alias for `almanac config set update_notifier true`. |
| `--disable-notifier` | Deprecated alias for `almanac config set update_notifier false`. |

**Exit codes:** `0` on successful install / check / dismiss / toggle. Install propagates npm's exit code on failure. `--check` exits `1` when the registry is unreachable.

**EACCES:** if `npm i -g` fails with a permission error, try `sudo npm i -g codealmanac@latest`, or switch to a version manager (nvm/volta/fnm) that doesn't require root. codealmanac will never sudo on your behalf — silent privilege escalation would violate the trust contract.

### 1.5 `--stdin` pipe semantics

Commands that accept `--stdin`: `show`, `tag`, `health`.

- One slug per line; blank lines ignored; whitespace trimmed.
- Output order mirrors input order.
- Missing slugs don't abort the output — every found slug still gets printed, and each missing slug writes `almanac: no such page "<slug>"` to stderr.
- **Exit code reflects completeness.** `show --stdin` exits `1` if any slug was missing, `0` only when every requested slug resolved. This is what `xargs` + CI wants: a pipeline that silently drops slugs is a bug, not a feature. Use `|| true` or `; :` to continue past it when you genuinely don't care.
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

CRLF-terminated files are handled transparently — `show --body` strips frontmatter without leaving a stray `\r` at the body head.

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
  info=$(almanac show "$slug" --json)
  prose=$(echo "$info" | jq -r '.file_refs[].path' | sort -u)
  fm=$(echo "$info" | jq -r '.files[]' | sort -u)
  missing=$(comm -23 <(echo "$prose") <(echo "$fm"))
  [ -n "$missing" ] && { echo "$slug:"; echo "$missing" | sed 's/^/  /'; }
done
```

**Open every orphan page in `$EDITOR`:**
```bash
almanac search --orphan | almanac show --stdin --path | xargs -n 1 "$EDITOR"
```

**Export a page's body to a standalone markdown file:**
```bash
almanac show checkout-flow --body > checkout-flow.md  # exactly one trailing \n
```

**Doctor a flaky install in CI:**
```bash
almanac doctor --json | jq '.install[] | select(.status == "problem")'
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
3. Background `almanac capture "$TRANSCRIPT" --session "$SESSION_ID" --quiet`, redirect to `.almanac/logs/.capture-$SESSION_ID.log`, `disown`.
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

`almanac setup` wraps `hook install` alongside the guides. `almanac uninstall` wraps `hook uninstall` alongside guide removal. You rarely invoke `hook *` directly.

### Diagnosing "capture didn't run"

```bash
almanac doctor              # catch-all — reports hook state + last capture age
almanac hook status         # just the hook entry
ls -lah .almanac/logs/.capture-*.log
```

Installed but no log: `SessionEnd` didn't fire (rare, hard crash), or script bailed before backgrounding (add `set -x` to trace), or no `.almanac/` upward from `cwd` (silent correct no-op).

### Diagnosing "capture ran but wrote nothing"

```bash
tail -200 .almanac/logs/.capture-<id>.log
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

- **Silent auto-register** — every query/edit command (except `list --drop`) calls `autoRegisterIfNeeded` on cwd. A repo with `.almanac/` but no registry entry → added with `name = basename(cwd)`, no description. Makes "cloned a repo with `.almanac/` committed" just work.
- **`almanac bootstrap`** — auto-registers as a side effect of scaffolding. `name` defaults to the repo basename; edit `~/.almanac/registry.json` or re-bootstrap to rename.
- **`almanac list --drop <name>`** — the only removal path. Skips auto-register so the removal isn't immediately undone.

### `--wiki <name>`

Route the command at a specific registered wiki. Used when you're in one repo but querying another. Without `--wiki`, commands resolve to the wiki whose `path` is an ancestor of cwd. If none, commands error: `almanac: no .almanac/ found in this directory or any parent; run 'almanac bootstrap' first`.

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

### Catch-all: `almanac doctor`

When something feels off and you don't know where to start, run `almanac doctor`. It reports install state (binary, native binding, Claude auth, hook, guides, import line) and current-wiki state (registered, page/topic counts, index freshness, last capture age, health problems). Every ✗ comes with a one-line `run: …` fix. `--json` for scripting.

### "better-sqlite3 bindings missing"
Node version / arch mismatch with the prebuilt binary. `almanac doctor` reports it as `install.sqlite: problem` with the underlying error's first line. Fix:
```bash
npm rebuild better-sqlite3   # in the install directory
```
On M-series Macs with x64+arm64 Node installs, bindings are arch-specific — rebuild in the arch you'll run from. Node ≥20 required (`engines.node`).

### "search returns nothing"

Two different outcomes to distinguish:
- **Silent stdout, stderr says `# 0 results`.** The query ran and genuinely matched nothing — this is an answer, not a failure. Either the wiki doesn't cover that area yet, or the query needs broadening.
- **An actual error on stderr.** Commander or `almanac:` prefix. That's a broken invocation; re-read the `--help`.

`--json` is silent on stderr — the `[]` array is the unambiguous empty signal.

### "pages don't show up in `--mentions`"

Missing `files:` frontmatter, OR path referenced only in inline prose (not via `[[...]]`). Inline prose isn't indexed. If neither: `almanac reindex`.

### "topics missing after rename"

`topics rename` bumps `topics.yaml` mtime → next query's `ensureFreshIndex` catches up. Hand-edited `topics.yaml` without page rewrites leaves frontmatter out of sync — `almanac reindex` then audit with `almanac health --orphans --empty-topics`.

### "capture didn't fire"

```bash
almanac doctor              # reports hook state + last capture age + auth
claude auth status          # OAuth token present?
echo "${ANTHROPIC_API_KEY:0:10}"   # API key fallback?
ls -lah .almanac/logs/.capture-*.log
```

No logs at all → script bailed pre-background. Add `set -x` to `hooks/almanac-capture.sh` to trace. If the hook itself isn't installed, `almanac doctor` reports `install.hook: problem` with `run: almanac setup --yes`.

### "slug collision warnings"

Two files kebab-case to the same slug (`Checkout Flow.md` and `checkout-flow.md`). `health --slug-collisions` lists them. Rename one, grep `.almanac/pages/` for any `[[...]]` references, update them.

### "dead-refs reports files that exist"

Case sensitivity on Linux. Schema v2 stores `original_path` for case-preserving stat; upgrade from pre-v2 requires `almanac reindex`. Dangling symlinks also fail `existsSync`.

### Forensics files

- `.almanac/logs/.capture-<session-id>.jsonl` — SDK message stream from `almanac capture` (one JSON object per line). Writer + reviewer interleaved.
- `.almanac/logs/.capture-<session-id>.log` — companion sidecar written by the SessionEnd hook: stdout+stderr of `almanac capture`, human-readable. Present only for hook-invoked captures; manual invocations emit only the `.jsonl`.
- `.almanac/logs/.bootstrap-<timestamp>.log` — one per bootstrap. Gitignored by default.

---

## 11. Updates: nag banner + manual install

Tier B design, per the pair review. No silent auto-install. The CLI self-schedules a detached background version check after each command; the next command's banner reflects what that check learned. Installing is always a foreground action the user chooses.

### How it works

```
command runs
   │
   ├─ pre:  announceUpdateIfAvailable()   ── reads ~/.almanac/update-state.json (sync)
   │                                         prints stderr banner if outdated
   │
   ├─ (command does its thing)
   │
   └─ post: spawn --internal-check-updates (detached, stdio: ignore)
                                            queries registry.npmjs.org
                                            writes ~/.almanac/update-state.json
                                            exits
```

### State files

- **`~/.almanac/update-state.json`** — written by the background worker + `almanac update`. Shape: `{last_check_at, installed_version, latest_version, dismissed_versions[], last_fetch_failed_at?}`. `last_check_at` is epoch seconds; `dismissed_versions` is a list of version strings the user muted via `--dismiss`. Missing / malformed → all read paths return defaults. Never break the CLI.
- **`~/.almanac/config.json`** — `{update_notifier: boolean}`. Toggles whether the banner ever prints. Default `true`. Flip via `almanac config set update_notifier true` / `false`.

### Cache behavior

- Background check runs at most once per 24h (comparing `last_check_at` to now).
- `almanac update --check` bypasses the cache for immediate status.
- Failed registry fetches bump `last_check_at` anyway so a one-shot failure doesn't hammer the registry on every subsequent invocation. The 24h cycle resumes as normal.
- Network timeout is 3s; longer would be noticeable in the background spawn.

### Dismissal semantics

`almanac update --dismiss` appends the current `latest_version` to `dismissed_versions[]`. The banner suppresses **only that specific version** — when a newer one ships, `latest_version` moves on and the banner reappears. Multiple consecutive dismissals accumulate; `dismissed_versions` is never trimmed automatically. If you find yourself dismissing every release, `almanac config set update_notifier false` is the right tool instead.

Dismissal does NOT prevent `almanac update` from installing. It only silences the banner.

### Test / CI gating

The post-command background spawn is gated on `process.env.NODE_ENV !== "test"`, `!process.env.VITEST`, and `!process.env.CODEALMANAC_SKIP_UPDATE_CHECK`. Test suites never fork update workers; CI pipelines that want to opt out set `CODEALMANAC_SKIP_UPDATE_CHECK=1`.

### Why not auto-install

From the pair review:
- Silent install without consent violates trust norms; users expect to choose when their tooling changes under them.
- `npm i -g` prefixes diverge across nvm, volta, fnm, and system Node; guessing wrong corrupts the PATH.
- Detached-child survival is fragile in Claude Code subprocesses, CI runners, and Windows — a mid-install kill leaves a half-linked binary.
- Mid-invocation binary swap breaks `import()` of dist chunks that haven't yet been loaded.

The manual `almanac update` in the foreground resolves all of these: user sees what's running, npm picks its own prefix, the child is owned by the user's shell, and the running process doesn't touch its own files.

---

## When in doubt

- `almanac --help` / `almanac <command> --help` — flags are always current for the installed build.
- `almanac doctor` — one command that reports everything relevant about install + current wiki.
- `.almanac/README.md` in the repo — the notability bar and topic taxonomy for *this* repo override anything here.

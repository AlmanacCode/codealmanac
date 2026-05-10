# codealmanac — a wiki for this codebase, maintained for you

This repo has a `.almanac/` directory. It's a **living wiki** written for AI agents, documenting the things the code can't say: **why** it's shaped this way, **what was tried and failed**, **what must not be violated**, **how things flow end-to-end**, and **known gotchas** discovered through real debugging.

You are the primary reader. When the user asks you to do something, **check the wiki before you touch related code** — it will often answer the question the user didn't think to ask ("we tried that in March, here's why it broke").

You usually don't write the wiki during normal work. `almanac capture` runs automatically at session end through the installed hook, reads the session transcript, and starts an Absorb job that writes or updates pages. Your job during the session is: **read, use, occasionally fix obvious errors.**

---

## The mental model in 60 seconds

- **Pages** are markdown files in `.almanac/pages/` with YAML frontmatter. One page per stable concept: a technology we depend on (`supabase`), a multi-file flow (`checkout-flow`), a decision (`jwt-vs-sessions`), a gotcha (`stripe-webhook-deadlock`).
- **Topics** organize pages. They form a **DAG** — each page has multiple topics, each topic can have multiple parents. Topics live in `.almanac/topics.yaml`.
- **Links** use one syntax: `[[...]]`. The classifier looks at content:
  - `[[checkout-flow]]` → page slug (no slash)
  - `[[src/checkout/handler.ts]]` → file reference (has slash)
  - `[[src/checkout/]]` → folder reference (trailing slash)
  - `[[openalmanac:supabase]]` → cross-wiki reference (colon prefix)
- **Frontmatter carries `topics:` and `files:`.** The `files:` list is load-bearing: it's how `almanac search --mentions src/foo.ts` finds pages about `src/foo.ts` even when the path isn't in the prose.
- **The wiki evolves.** When facts change, existing pages get edited in place — git history is the archive. Fundamental reversals use a separate "archive" mechanism; you rarely need to worry about it.

Read `.almanac/README.md` at the start of any session where the wiki is likely to be relevant. It carries this repo's **notability bar** (what deserves a page here) and topic taxonomy.

---

## When to reach for it

**At the start of a task that touches real subsystems**, before you do anything else:

```bash
almanac search --mentions src/checkout/handler.ts
almanac search --mentions src/checkout/
almanac search "checkout timeout"
almanac search --topic checkout
```

The output is page slugs. Pick 1-3 that look relevant, `almanac show <slug>`, follow `[[wikilinks]]` the way you'd follow imports. Do this *before* grepping the codebase for unfamiliar behavior — the wiki tells you *why*, the code tells you *what*.

**Skip the wiki when**: the task is a pure typo fix, styling tweak, scoped refactor inside one file you already understand, or anything where the user's request is literally "read this file and tell me X."

**Trust the code over the wiki when they disagree.** Code is truth. If the wiki is wrong, fix the wiki — but don't propagate the wiki's error into code.

---

## The commands you'll use

Other commands exist (`list`, `tag`, `untag`, `hook`, `uninstall`, `doctor`, etc.) — most are administrative. See `almanac --help` or `@~/.claude/codealmanac-reference.md` for the full surface. In normal sessions you'll live in the four commands below.

### 1. `almanac search` — the starting point

```bash
almanac search "<query>"                        # FTS
almanac search --mentions src/path/to/file.ts   # pages referencing this file
almanac search --mentions src/path/to/folder/   # pages referencing anything in this folder
almanac search --topic auth                     # active pages in a topic
almanac search --topic auth --topic decisions   # intersection
```

Useful when you need them:
- `--since 2w` / `--stale 30d` — freshness filters
- `--orphan` — pages with no topics (usually a bug to fix)
- `--include-archive` — include historical pages when active wiki feels sparse
- `--limit N`, `--json` — output control

Returns slugs, one per line. Pipe-friendly. Filters AND-intersect.

### 2. `almanac show <slug>` — read a page

```bash
almanac show checkout-flow                 # metadata header + body (default)
almanac show checkout-flow --body          # body only
almanac show checkout-flow --meta          # metadata only
almanac show checkout-flow --lead          # first paragraph (cheap preview)
almanac show checkout-flow --backlinks     # pages linking TO this one
almanac show checkout-flow --links         # pages this links out to
```

`--lead` to triage long result lists. `--backlinks` before editing a load-bearing page — you want to know who depends on its current shape.

### 3. `almanac topics` — understand structure

```bash
almanac topics                             # list all with page counts
almanac topics show auth                   # description, parents, children, pages
almanac topics show auth --descendants     # walks the DAG subtree
```

`--descendants` is the right call for "everything tagged auth or under it" — subtopics like `jwt`, `sessions`, `oauth` get walked automatically.

### 4. Read the file directly

`.almanac/pages/<slug>.md` is just markdown. The Read tool works fine. The CLI is faster when you want composed metadata; Read is fine for scanning prose or editing.

### 5. `almanac health` — when something feels off

```bash
almanac health                # 8-category graph integrity report
almanac health --topic auth   # scope
```

Run when cleaning up the wiki, when the user reports broken links, or after you deleted/moved code and want to know which pages now reference dead files.

Categories: `orphans`, `stale` (90+ days), `dead-refs`, `broken-links`, `broken-xwiki`, `empty-topics`, `empty-pages`, `slug-collisions`.

---

## Decisions you'll face

### "Search the wiki or just grep?"
Search when the task is named: subsystem (checkout, auth, search), external service (Stripe, Supabase), cross-cutting concern (caching, sessions). Grep for mechanical tasks.

### "The wiki says X. The code does Y. Which is right?"
The code. Then fix the wiki — small fixes edit the page directly. Substantial changes: mention clearly in your response so capture has context to update at session end.

### "Should I create a new page mid-session?"
Usually no. Capture writes pages from the session transcript with full context. Exceptions: user explicitly asks, or you're doing deliberate wiki maintenance.

When you do write: read `.almanac/README.md` for the notability bar, use `[[...]]` syntax, include `files:` frontmatter, keep every sentence factual, no speculation.

### "New topic or existing?"
Almost always existing. Skim `almanac topics` before creating. New topic is justified when multiple pages share a concept no current topic captures.

### "Can I just `almanac tag`?"
Yes — safe, idempotent, preserves body bytes. Use `almanac tag` / `untag` rather than hand-editing frontmatter.

### "The wiki returned nothing. Now what?"
Trust the silence. Empty stdout with `# 0 results` on stderr means the query ran cleanly and matched nothing — the wiki doesn't have a page on that yet, or the query needs to be broader. That is the answer, not a bug. Don't fall back to guessing; fall back to the code, and trust that capture will surface the knowledge the next time a session naturally discovers it.

If stderr shows a real error (an `almanac:` prefix or a commander parse failure), the invocation is broken — re-read `almanac --help` for the right flags.

---

## A concrete example

User: *"the indexer isn't picking up my new page, what's going on?"*

```bash
# 1. Find pages touching the indexer
$ almanac search --mentions src/indexer/
sqlite-indexer
wikilink-syntax

# 2. Triage with --lead
$ almanac show sqlite-indexer --lead
The indexer (`src/indexer/`) builds and maintains `.almanac/index.db` — a
SQLite database that powers all query commands (`search`, `show`, `health`,
`topics show`). It runs silently before every query command, comparing page
file mtimes against the stored `content_hash`; only changed or new pages are
re-parsed.

# 3. Read the most relevant
$ almanac show sqlite-indexer
# ...covers the schema, freshness rules, and where new pages get picked up

# 4. Before you touch anything, check backlinks
$ almanac show sqlite-indexer --backlinks
```

You now know: the indexer only re-parses pages whose mtime is newer than the stored `content_hash`, runs on every query command, and backing it is a schema you can read at `src/indexer/schema.ts`. The lead alone ruled out two entire hypotheses ("maybe it only indexes on startup", "maybe I need to restart something") before you read any source code.

You don't write anything. At session end the capture agent reads the transcript, sees your discovery, writes or updates pages. Next session, a different agent running a related task sees it surface in `--mentions`.

---

## What runs automatically (don't invoke these)

- **`almanac capture`** — starts a background Absorb job after supported agent sessions through the installed hook.
- **`almanac reindex`** — runs implicitly before every query when pages changed.

Run `almanac init` yourself when you are creating the first wiki for a repo.

---

## Cross-wiki references

If the user has multiple repos with `.almanac/`, they're globally registered. Pages can reference other wikis with `[[wiki-name:slug]]`. `--wiki <name>` or `--all` span registered wikis. You rarely need this mid-session.

---

## Writing conventions (if you do write)

- **Every sentence contains a specific fact.** If the sentence could describe any codebase, cut it.
- **Neutral tone.** "is", not "serves as". No promotional language, no "plays a pivotal role", no interpretive "-ing" clauses.
- **No speculation.** If you don't know why, don't guess in prose.
- **Prose first.** Bullets for genuine lists. Tables for structured comparison only.
- **Reference code with `[[...]]`.** Inline mentions are fine but only `[[...]]` gets indexed.
- **List files in frontmatter.** Pages about specific code need `files: [...]` to surface in `--mentions` queries.

The Absorb/Garden prompts enforce these during wiki-writing runs. Stricter with yourself = less rework.

---

## Troubleshooting

### `almanac doctor` is the catchall
When anything feels off and you don't know where to start, run `almanac doctor`. It reports the install (binary, native SQLite binding, Claude auth, hook, guides, CLAUDE.md import) and the current wiki (registered, page/topic counts, index freshness, last capture age, health problems). Every ✗ comes with a one-line `run: …` fix. Add `--json` for scripting.

### "better-sqlite3 bindings failed"
Node version or arch mismatch with the prebuilt native binding. `almanac doctor` reports this under `install.sqlite` with the raw error. Fix by rebuilding the native binding:
```bash
npm rebuild better-sqlite3   # in the install directory
```

### "search returned nothing"
Empty stdout plus `# 0 results` on stderr means the query ran and genuinely matched nothing. Don't retry with random flag permutations — either broaden the query, or accept the wiki hasn't covered that area yet. A real error would have come with an `almanac:`-prefixed stderr line.

`--json` is silent on stderr — the `[]` array is the empty signal there.

### "capture didn't fire after my last session"
```bash
almanac doctor              # install.hook: ok/problem, wiki.capture: last capture age
almanac hook status         # just the hook entry
almanac jobs
ls -lah .almanac/runs/
```
No jobs at all → the hook isn't installed, bailed before starting capture, or `cwd` was outside any wiki (silent correct no-op). Capture ran but wrote nothing → the Absorb run decided there was no durable wiki change, or the session was pure-read. Use `almanac jobs show <run-id>` and `almanac jobs logs <run-id>` for details.

---

## Staying current

codealmanac checks for updates in the background (once per 24h) after each
command. When a new version is available, you'll see a stderr banner on
every subsequent invocation:

```
! codealmanac 0.1.6 available (you're on 0.1.5) — run: almanac update
```

The banner shows on every command until you update or dismiss it. Run:

```bash
almanac update              # upgrade to latest (foreground `npm i -g codealmanac@latest`)
almanac update --dismiss    # skip this version; banner goes away until the next release
almanac update --check      # check now without installing (bypasses 24h cache)
almanac doctor              # see current update status + notifier setting
```

Auto-install is deliberately NOT the default — silent install without consent
violates the trust contract, npm prefixes diverge across version managers, and a
mid-invocation binary swap corrupts dynamic imports. Tier B (nag + manual
install) is the design. See `almanac update --help` for the full flag set.

---

## When in doubt

- `.almanac/README.md` — repo-specific conventions + notability bar
- `@~/.claude/codealmanac-reference.md` — full command reference with every flag
- `almanac --help`, `almanac <command> --help` — built-in

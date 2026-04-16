# codealmanac — a wiki for this codebase, maintained for you

This repo has a `.almanac/` directory. It's a **living wiki** written for AI agents, documenting the things the code can't say: **why** it's shaped this way, **what was tried and failed**, **what must not be violated**, **how things flow end-to-end**, and **known gotchas** discovered through real debugging.

You are the primary reader. When the user asks you to do something, **check the wiki before you touch related code** — it will often answer the question the user didn't think to ask ("we tried that in March, here's why it broke").

You don't write the wiki during normal work. A separate agent ("capture") runs automatically at session end via a Claude Code hook, reads the session transcript, and writes or updates pages. Your job during the session is: **read, use, occasionally fix obvious errors.**

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

## The five commands you'll actually use

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
almanac show checkout-flow --raw           # body only
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

---

## A concrete example

User: *"fix the checkout timeout bug."*

```bash
# 1. Find relevant pages
$ almanac search --mentions src/checkout/
checkout-flow
inventory-lock-gotcha
stripe-async-migration

# 2. Triage with --lead
$ almanac show checkout-flow --lead
$ almanac show inventory-lock-gotcha --lead

# 3. Read the most relevant
$ almanac show inventory-lock-gotcha
# ...points to [[stripe-deadlock]], show that too

# 4. Before editing, check backlinks
$ almanac show checkout-flow --backlinks
```

You now know: there was a deadlock between webhooks and the inventory lock, the team moved to async Stripe in April, two other pages link to `checkout-flow` so your edits matter beyond this file.

You don't write anything. At session end the capture agent reads the transcript, sees your discovery, writes or updates pages. Next session, a different agent running a related task sees it surface in `--mentions`.

---

## What runs automatically (don't invoke these)

- **`almanac capture`** — runs in the background after every Claude Code session via the `SessionEnd` hook.
- **`almanac reindex`** — runs implicitly before every query when pages changed.
- **`almanac bootstrap`** — one-shot scaffolding. You almost certainly don't run this.

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

The reviewer subagent (run by capture at session end) enforces these. Stricter with yourself = less rework.

---

## When in doubt

- `.almanac/README.md` — repo-specific conventions + notability bar
- `@~/.claude/codealmanac-reference.md` — full command reference with every flag
- `almanac --help`, `almanac <command> --help` — built-in

# Almanac Wiki

This is the Almanac wiki for the codealmanac repo itself — the CLI and agent harness that produces and queries `.almanac/` wikis. It documents what the code can't say: design decisions, subsystem contracts, agent prompt behavior, and gotchas found in real runs.

The primary reader is an AI coding agent picking up a new session. Write accordingly: dense, factual, linked.

## Notability bar

Write a page when there is **non-obvious knowledge that will help a future agent**. Specifically:

- A decision that took discussion, research, or trial-and-error (e.g. GLOB vs LIKE for path queries)
- A gotcha discovered through failure (e.g. FTS5 ON DELETE CASCADE doesn't fire)
- A cross-cutting flow that spans multiple files (e.g. capture resolving a transcript, starting Absorb, and recording a run)
- A constraint or invariant not visible from the code (e.g. registry entries are never auto-dropped)
- A subsystem or third-party integration referenced by multiple pages

Do not write pages that restate what the code does. Do not write pages of inference. Silence is acceptable. Build, Absorb, and Garden enforce this bar through prompts, not through a TypeScript review pipeline.

## Topic taxonomy

Topics form a DAG serialized in `.almanac/topics.yaml`. A page can belong to multiple topics.

| Topic | What belongs here |
|-------|------------------|
| `stack` | Third-party libraries and services we depend on |
| `systems` | Custom subsystems built in this repo (indexer, registry, DAG, viewer) |
| `flows` | Multi-step processes spanning files (capture, build, jobs) |
| `decisions` | Architectural choices — "why X over Y" |
| `agents` | AI agent integration: harness providers, operation prompts, Build/Absorb/Garden (child of `flows` + `stack`) |
| `cli` | CLI command surface and wiring (child of `systems`) |
| `storage` | SQLite index and registry persistence (child of `systems`) |

Add domain topics as the wiki grows. New topics go in `topics.yaml`; `almanac topics create` handles this.

## Page shapes

Four shapes cover most pages here. They are suggestions, not a schema.

- **Entity** — a stable named thing: Claude Agent SDK, the SQLite indexer, the global registry
- **Decision** — "why we chose X" — includes the rejected alternatives and their cost
- **Flow** — a multi-file process: build operation, capture flow, process manager run lifecycle
- **Gotcha** — a specific surprise, constraint, or invariant to preserve

## Writing conventions

- Every sentence contains a specific fact. If it doesn't, cut it.
- Neutral tone. "is", not "serves as". No vague attribution, no hedging.
- Prose first. Bullets for genuine lists. Tables only for structured comparison.
- No formulaic conclusions. End with the last substantive fact.
- Reference env vars by name: `ANTHROPIC_API_KEY`, not "the API key". Reference config paths exactly: `~/.almanac/registry.json`, `~/.claude/settings.json`.
- No speculative content ("chosen for scalability" when we don't know why).

## Linking

One double-bracket syntax, disambiguated by content:

- `[[capture-flow]]` — page slug (no slash)
- `[[src/indexer/schema.ts]]` — file reference (has slash)
- `[[src/indexer/]]` — folder reference (trailing slash)
- `[[other-wiki:slug]]` — cross-wiki reference (colon before slash)

Every entity page should be linked from the pages that depend on it. A page with no links in or out is suspect.

## Pages live in `.almanac/pages/`

One markdown file per page, kebab-case slug. Frontmatter carries `title:`, `topics:`, and `files:` (list the specific files where this thing lives). The rest is prose.

The flat layout is intentional. Topics are a multi-parent DAG — a single page can belong to `flows`, `decisions`, `storage`, and `cli` simultaneously. Nesting pages under topic folders would either lose those relationships or require duplication.

## Human browsing

`almanac serve` starts a local read-only viewer at `http://localhost:3927`. It is the primary way for humans to read the wiki: rendered markdown, clickable wikilinks, FTS search, topic browser, and backlinks panel per page. See [[almanac-serve]] for architecture and design details.

The filesystem (`.almanac/pages/`) is the source of truth and the editing surface. The viewer is disposable — kill it, restart it, get the same wiki.

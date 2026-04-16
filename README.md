# codealmanac

codealmanac maintains a `.almanac/` folder in your repo that AI coding agents populate with decisions, gotchas, flows, and invariants — the context the code itself can't tell you. Pages are atomic markdown files, interlinked by `[[wikilinks]]`, indexed in SQLite, and written by a writer/reviewer agent pair that runs at session end.

The primary consumer is the AI coding agent. The secondary consumer is humans.

## Why

Claude Code, Cursor, and Copilot can read the code and tell you what it does. They can't tell you why it's shaped that way, what approaches were tried and rejected, what invariants must not be violated, or how a flow spans four files in three services. That knowledge lives in Slack threads, PR descriptions, and people's heads. It dies when threads scroll, people leave, or an agent starts a fresh session.

A single `CLAUDE.md` at the repo root doesn't scale past a few hundred lines, has no graph structure, and gets stale the moment anyone commits without editing it. codealmanac replaces that one flat file with a wiki of atomic pages that agents are prompted to keep current as a side-effect of coding.

## How it works

Each repo gets a committed `.almanac/pages/` directory of markdown files. A SessionEnd hook fires when a Claude Code session ends and runs `almanac capture` in the background. A writer agent reads the session transcript and existing pages, drafts changes, and invokes a reviewer subagent that critiques against the wider graph. The writer applies the final versions. New and updated pages show up in your next `git status`; you review them like any other commit.

The CLI never reads or writes page content except in `capture` and `bootstrap`. Every other command (`search`, `show`, `info`, `topics`, `tag`, `health`) operates on a SQLite index that rebuilds silently whenever pages are newer than the index.

## Install

```bash
npm install -g codealmanac
# or for one-off use:
npx codealmanac --help
```

Installs two binaries pointing at the same entry: `codealmanac` (canonical) and `almanac` (alias). Requires Node 20 or newer.

`bootstrap` and `capture` call the Anthropic API and need `ANTHROPIC_API_KEY` in your environment. The query commands (`search`, `show`, `info`, `health`, `topics`) need no API key.

## Quickstart

```bash
cd your-repo

almanac init
# scaffolds .almanac/pages/ and .almanac/README.md, registers the wiki
# in ~/.almanac/registry.json, adds .almanac/index.db to .gitignore

almanac bootstrap
# spawns an agent that reads package.json, docker-compose.yml, the
# top-level layout, and writes stub entity pages + a topic DAG

almanac search "auth"
# full-text search across pages; prints slugs one per line

almanac hook install
# adds the SessionEnd entry to ~/.claude/settings.json so capture
# runs at the end of every Claude Code session

# from here on, just code as usual — capture runs itself
```

## Command reference

| Command | What it does |
|---------|--------------|
| `almanac init` | Scaffold `.almanac/` and register the wiki globally |
| `almanac list` | List every registered wiki (`--drop <name>` to remove) |
| `almanac bootstrap` | Agent reads the repo and seeds stub entity pages + topic DAG |
| `almanac search [query]` | FTS, `--topic`, `--mentions <path>`, `--since`, `--stale`, `--orphan` |
| `almanac show <slug>` | Print a page's markdown to stdout |
| `almanac path <slug>` | Resolve a slug to its absolute file path |
| `almanac info <slug>` | Topics, file refs, wikilinks, lineage for a page |
| `almanac topics` | List, create, link, rename, delete topics in the DAG |
| `almanac tag <page> <topic>...` | Add topics to a page |
| `almanac untag <page> <topic>` | Remove a topic |
| `almanac health` | Orphans, stale pages, dead refs, broken links, slug collisions |
| `almanac capture [transcript]` | Writer + reviewer on a Claude Code session transcript |
| `almanac hook install\|uninstall\|status` | Manage the SessionEnd hook in `~/.claude/settings.json` |
| `almanac reindex` | Force rebuild of `.almanac/index.db` |

Every command that returns pages prints slugs one per line; pass `--json` for structured output; pipe slugs into commands that accept `--stdin`. Run `almanac <command> --help` for the full flag surface.

## Concepts

### Page shapes (suggestions, not rules)

The wiki tends to organize around four kinds of pages, but nothing in the system enforces them:

- **Entity pages** — stable named things (Supabase, Stripe, a custom auth system). These are the anchors other pages link to.
- **Decision pages** — why X over Y, with context and consequences.
- **Flow pages** — how a multi-file process works end-to-end.
- **Gotcha pages** — specific failures or constraints, usually anchored to an entity.

A page that doesn't fit any of these is fine. Pick the shape that serves the knowledge.

### Topics as a DAG

One organizational axis: topics. Topics form a directed acyclic graph — a topic can have multiple parents, and a page can belong to multiple topics. No page type system.

```
decisions   stack      flows
            └─ database
               └─ supabase   ← a page tagged [stack, database]
```

`almanac topics show database --descendants` walks the subgraph and returns every page in `database` or `supabase`. Cycles are prevented by a `CHECK` constraint and a depth cap.

### The unified `[[...]]` link syntax

One link form, disambiguated by content:

```markdown
See [[checkout-flow]] for the full sequence.           ← page slug (no slash)
The handler [[src/checkout/handler.ts]] does X.        ← file (has slash)
This spans [[src/checkout/]] generally.                ← folder (trailing slash)
See [[openalmanac:supabase]] for cross-wiki context.   ← cross-wiki (colon prefix)
```

The indexer classifies each link by those rules and writes it to `wikilinks`, `file_refs`, or `cross_wiki_links`. `almanac search --mentions src/checkout/handler.ts` returns every page referencing that file or any folder containing it.

### Archive vs edit

Most changes are edits — the page is updated in place to reflect current truth, with git history as the archive. When a page's central decision is reversed (not just refined), the old page is marked `archived_at` and `superseded_by`, a new page is created with `supersedes`, and both live side by side. Archived pages are excluded from `almanac search` by default and exempt from dead-ref health checks.

### The notability bar

Every repo's `.almanac/README.md` contains a notability bar: the threshold for what deserves a page. The default is "non-obvious knowledge that will help a future agent" — decisions that took research, gotchas discovered through failure, cross-cutting flows, constraints not visible in code. The writer consults the bar before writing; the reviewer enforces it. Edit the bar to match your repo's taste.

## How capture works

A page looks like this:

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

When a Claude Code session ends, the SessionEnd hook backgrounds `almanac capture <transcript>`. The writer agent reads the transcript, runs `almanac search` and `almanac show` against the existing wiki, drafts changes to pages under `.almanac/pages/`, and invokes the reviewer subagent. The reviewer reads across the graph, flags duplicates, missing wikilinks, missing topics, inference dressed as fact, and cohesion problems, then returns a text critique. The writer decides what to incorporate and writes the final versions. Capture writes nothing if nothing in the session meets the notability bar — silence is a valid outcome.

No proposal files, no `--apply` step, no state machine between writer and reviewer. The changes land in `git status` and you commit them like anything else.

## Multi-wiki

Each repo has its own sovereign `.almanac/`. The global registry at `~/.almanac/registry.json` tracks every wiki on the machine.

```bash
almanac list                            # all registered wikis
almanac search --wiki openalmanac "RLS" # specific wiki
almanac search --all "RLS"              # every registered wiki
```

Cross-wiki references use a colon prefix: `[[openalmanac:supabase]]`. The segment before `:` resolves via the registry; unreachable wikis are silently skipped rather than erroring. Cloning a repo with a committed `.almanac/` auto-registers it on the first `almanac` command.

## Writing conventions

Pages are neutral-tone encyclopedia-style prose — every sentence contains a specific fact, no significance inflation, no hedging, no formulaic conclusions. Prose first, bullets for genuine lists, tables only for structured comparison. The conventions are described in each repo's `.almanac/README.md` (generated by `init` and refined by `bootstrap`); the reviewer loads them at runtime and enforces them on every proposal.

## Status

`v0.1.0`, pre-release. Node 20+. Release process is documented in [RELEASE.md](./RELEASE.md). Breaking changes are possible before 1.0; they will be called out in release notes.

## Philosophy

Intelligence lives in the prompt, not in the pipeline. Whenever a task calls for judgment — deciding what from a session is worth capturing, evaluating a proposal against the graph, picking between editing and archiving — codealmanac hands a concrete-but-open prompt to an agent. It does not wrap agents in propose/review/apply state machines, intermediate proposal files, or `--dry-run` rehearsal flags. The CLI finds and organizes; the agents do the thinking. If a future change can be expressed as a longer prompt or as more pipeline code, the prompt almost always wins.

## Related

codealmanac is part of the [OpenAlmanac](https://www.openalmanac.org) family. OpenAlmanac is a knowledge base for curious people; codealmanac is knowledge for codebases. Same writing standards, different reader.

## License

MIT. Copyright (c) 2026 Rohan Sheth. See [LICENSE](./LICENSE).

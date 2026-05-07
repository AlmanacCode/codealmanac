# codealmanac

A living wiki for your codebase, maintained by AI agents. It documents what the code can't say — decisions, flows, invariants, gotchas — as atomic, interlinked markdown pages living at `.almanac/` in your repo.

```
your-repo/
├── src/
├── .almanac/
│   ├── pages/
│   │   ├── supabase.md
│   │   ├── checkout-flow.md
│   │   └── uuid-decision.md
│   ├── topics.yaml
│   └── index.db          ← auto-generated SQLite index
├── .git/
└── ...
```

The primary consumer is the AI coding agent. The secondary consumer is humans.

## Why

Claude Code, Cursor, and Copilot can read the code and tell you what it does. They can't tell you _why_ it's shaped that way, what approaches were tried and rejected, what invariants must not be violated, or how a flow spans four files in three services. That knowledge lives in Slack threads, PR descriptions, and people's heads. It dies when threads scroll, people leave, or an agent starts a fresh session.

A single `CLAUDE.md` at the repo root doesn't scale past a few hundred lines, has no graph structure, and gets stale the moment anyone commits without editing it. codealmanac replaces that one flat file with a wiki of atomic pages that agents are prompted to keep current as a side-effect of coding.

## How it works

Each repo gets a committed `.almanac/pages/` directory of markdown files. Auto-capture hooks fire when Claude Code, Codex, or Cursor Agent sessions end and run `almanac capture` in the background. A writer agent reads the session transcript and existing pages, drafts changes, and runs a reviewer pass against the wider graph. The writer applies the final versions. New and updated pages show up in your next `git status`; you review them like any other commit.

The CLI never reads or writes page content except in `capture` and `bootstrap`. Every other command (`search`, `show`, `topics`, `tag`, `health`) operates on a SQLite index that rebuilds silently whenever pages are newer than the index.

## Install

```bash
npx codealmanac                # installs globally + runs the setup wizard
# or, if you prefer the explicit two-step:
npm install -g codealmanac
codealmanac                    # interactive wizard
# or fully unattended:
codealmanac --yes
```

`codealmanac` (the bare invocation) routes to a setup wizard that:
- lets you choose a default agent: Claude, Codex, or Cursor,
- checks local agent readiness,
- installs auto-capture hooks for Claude, Codex, and Cursor,
- drops two agent guides into `~/.claude/` (`codealmanac.md` mini, `codealmanac-reference.md` full),
- appends `@~/.claude/codealmanac.md` to `~/.claude/CLAUDE.md` so every Claude Code session loads the mini guide.

The setup is idempotent — safe to re-run. Opt out with `--skip-hook` or `--skip-guides`. Later, `almanac uninstall` reverses it.

Two binaries ship, both pointing at the same entry: `codealmanac` (install surface) and `almanac` (day-to-day). Requires Node 20 or 22.

`bootstrap` and `capture` invoke your configured default agent. Claude uses the bundled Claude Agent SDK, Codex uses `codex exec --json`, and Cursor uses `cursor-agent --print --output-format stream-json`. The query commands (`search`, `show`, `health`, `topics`) need no credentials at all.

## Authentication

Pick the agent you want CodeAlmanac to use:

```bash
# Claude
claude auth login --claudeai
# or:
export ANTHROPIC_API_KEY=sk-ant-...

# Codex
codex login

# Cursor
cursor-agent login

# Verify all providers:
almanac agents list
almanac doctor
```

Set or change the default at any time:

```bash
almanac set default-agent codex
almanac set model codex gpt-5.3-codex
```

codealmanac itself never stores your provider credentials. Auth stays in each agent's normal local credential store.

## Quickstart

```bash
npm install -g codealmanac
codealmanac                   # interactive setup wizard; choose Claude/Codex/Cursor
                              # (or: codealmanac --yes)

cd your-repo
almanac bootstrap             # default agent reads the repo and seeds pages + topic DAG

almanac search "auth"         # full-text search across pages
almanac show checkout-flow    # read a page

# From here on, just code as usual — the installed hooks invoke
# `almanac capture` at session end, which writes and updates pages
# based on what happened in the session.
```

No `almanac init`. A wiki is scaffolded two ways: run `almanac bootstrap` yourself, or clone a repo that already has `.almanac/` committed (codealmanac auto-registers it on the first query).

Sanity-check the install with `almanac doctor` and `almanac agents list` — they report binary location, native SQLite binding, provider readiness, hook status, guides, import line, and current-wiki stats.

New to codealmanac? Read the [Concepts guide](./docs/concepts.md) for a walkthrough of pages, topics, files, the database, and the CLI.

## Commands

```bash
# Search & read
almanac search "auth"                        # full-text search across pages
almanac search --topic database              # filter by topic
almanac search --mentions src/lib/stripe.ts  # pages referencing a file
almanac show checkout-flow                   # read a page
almanac show checkout-flow --meta            # metadata only
almanac show checkout-flow --raw             # body only

# Organize
almanac topics list                          # all topics with page counts
almanac topics show database --descendants   # topic + its subtree
almanac tag <page> <topic...>                # add topics to a page
almanac health                               # graph integrity report

# Wiki lifecycle
almanac bootstrap --agent codex              # seed a new wiki from the repo
almanac capture --agent cursor <transcript>  # update wiki from a transcript
almanac hook install --source all            # auto-capture for Claude/Codex/Cursor

# Setup & diagnose
almanac agents list                          # provider readiness + default
almanac set default-agent codex              # change default provider
almanac doctor                               # check install + wiki health
almanac update                               # update to latest version
```

All commands output slugs one per line. Add `--json` for structured output. Pipe with `--stdin`:

```bash
almanac search --topic flows | almanac show --stdin
almanac search --stale 90d | almanac tag --stdin needs-review
```

Run `almanac <command> --help` for the full flag surface.

## How capture works

When a Claude, Codex, or Cursor session ends, the installed hook backgrounds `almanac capture`. The writer agent reads the session transcript, runs `almanac search` and `almanac show` against the existing wiki, drafts changes to pages under `.almanac/pages/`, and performs a reviewer pass. Claude uses its SDK's read-only reviewer subagent; Codex and Cursor perform the reviewer pass from prompt guidance until stricter provider enforcement lands. The reviewer checks duplicates, missing wikilinks, missing topics, inference dressed as fact, and cohesion problems. The writer decides what to incorporate and writes the final versions.

Capture writes nothing if nothing in the session meets the notability bar — silence is a valid outcome.

No proposal files, no `--apply` step, no state machine between writer and reviewer. The changes land in `git status` and you commit them like anything else.

### The notability bar

Every repo's `.almanac/README.md` contains a notability bar: the threshold for what deserves a page. The default is "non-obvious knowledge that will help a future agent" — decisions that took research, gotchas discovered through failure, cross-cutting flows, constraints not visible in code. The writer consults the bar before writing; the reviewer enforces it. Edit the bar to match your repo's taste.

### Archive vs edit

Most changes are edits — the page is updated in place to reflect current truth, with git history as the archive. When a page's central decision is reversed (not just refined), the old page is marked `archived_at` and `superseded_by`, a new page is created with `supersedes`, and both live side by side. Archived pages are excluded from `almanac search` by default and exempt from dead-ref health checks.

## Multi-wiki

Each repo has its own sovereign `.almanac/`. The global registry at `~/.almanac/registry.json` tracks every wiki on the machine.

```bash
almanac list                            # all registered wikis
almanac search --wiki openalmanac "RLS" # specific wiki
```

Cross-wiki references use a colon prefix: `[[openalmanac:supabase]]`. The segment before `:` resolves via the registry; unreachable wikis are silently skipped rather than erroring. Cloning a repo with a committed `.almanac/` auto-registers it on the first `almanac` command.

## Status

`v0.2.0`, pre-release. Node 20.x or 22.x. Release process is documented in [RELEASE.md](./RELEASE.md). Breaking changes are possible before 1.0; they will be called out in release notes.
## Philosophy

Intelligence lives in the prompt, not in the pipeline. Whenever a task calls for judgment — deciding what from a session is worth capturing, evaluating a proposal against the graph, picking between editing and archiving — codealmanac hands a concrete-but-open prompt to an agent. It does not wrap agents in propose/review/apply state machines, intermediate proposal files, or `--dry-run` rehearsal flags. The CLI finds and organizes; the agents do the thinking. If a future change can be expressed as a longer prompt or as more pipeline code, the prompt almost always wins.

## Contributing

codealmanac is open source under the MIT license. To set up a development environment:

```bash
git clone https://github.com/AlmanacCode/codealmanac.git
cd codealmanac
npm install
npm run build
npm link                  # makes `almanac` and `codealmanac` available globally
npm test                  # run the test suite (vitest)
```

The codebase is TypeScript, built with [tsup](https://tsup.egoist.dev/), tested with [Vitest](https://vitest.dev/). SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). AI features use the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents/agent-sdk).

### Project structure

```
src/
├── cli.ts              ← entry point and shortcut routing
├── cli/                ← commander command registration and help layout
├── commands/           ← one file per CLI command
├── indexer/            ← parses markdown → SQLite index
│   ├── schema.ts       ← DDL (CREATE TABLE statements)
│   ├── index.ts        ← incremental indexer (mtime-based freshness)
│   ├── frontmatter.ts  ← YAML frontmatter parser
│   ├── wikilinks.ts    ← [[link]] extractor + classifier
│   └── paths.ts        ← path normalization
├── registry/           ← global wiki registry (~/.almanac/registry.json)
├── topics/             ← topic DAG + frontmatter rewriting
├── agent/              ← Claude Agent SDK integration
├── paths.ts            ← find nearest .almanac/ (like git finds .git/)
└── slug.ts             ← kebab-case canonicalization
```

## Status

v0.1.10, pre-release. Node 20.x or 22.x. Release process is documented in [RELEASE.md](./RELEASE.md). Breaking changes are possible before 1.0; they will be called out in release notes.

## Related

codealmanac is part of the [OpenAlmanac](https://www.openalmanac.org) family. OpenAlmanac is a knowledge base for curious people; codealmanac is knowledge for codebases. Same writing standards, different reader.

## License

MIT. Copyright (c) 2026 Rohan Sheth. See [LICENSE](./LICENSE).

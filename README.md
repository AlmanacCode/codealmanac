# Almanac

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

A single `CLAUDE.md` at the repo root doesn't scale past a few hundred lines, has no graph structure, and gets stale the moment anyone commits without editing it. Almanac replaces that one flat file with a wiki of atomic pages that agents are prompted to keep current as a side-effect of coding.

## How it works

Each repo gets a committed `.almanac/pages/` directory of markdown files. Scheduled auto-capture periodically runs `almanac capture sweep`, scans quiet Claude/Codex transcripts created after automation was enabled, and starts background capture jobs for new material. CodeAlmanac builds one provider-neutral run spec, starts it through the process manager, and records local run state in `.almanac/runs/`. New and updated pages show up in your next `git status`; you review them like any other commit.

The CLI only invokes AI for the write-capable lifecycle commands: `init`, `capture`, `ingest`, and `garden`. Every query or organization command (`search`, `show`, `topics`, `tag`, `health`) operates on a SQLite index that rebuilds silently whenever pages are newer than the index.

## Install

```bash
npx codealmanac                # installs globally + runs the setup wizard
# or, if you prefer the explicit two-step:
npm install -g codealmanac
almanac                        # interactive wizard
# or fully unattended:
almanac --yes
```

The npm package is `codealmanac`; the command you use is `almanac` (or `alm`).
Bare `almanac` routes to a setup wizard that:
- lets you choose a default agent: Claude, Codex, or Cursor,
- lets you choose a provider model or inherit the provider default,
- checks local agent readiness,
- installs scheduled auto-capture with a macOS launchd job,
- drops two agent guides into `~/.claude/` (`almanac.md` mini, `almanac-reference.md` full),
- appends `@~/.claude/almanac.md` to `~/.claude/CLAUDE.md` so every Claude Code session loads the mini guide.

The setup is idempotent — safe to re-run. The first time automation is enabled, CodeAlmanac records `automation.capture_since` in `~/.almanac/config.toml`; scheduled sweeps ignore transcripts older than that activation timestamp instead of backfilling your whole chat history. Opt out with `--skip-automation` or `--skip-guides`. Use `--auto-capture-every <duration>` to change the default 5h sweep interval. Later, `almanac uninstall` reverses it.

The canonical binaries are `almanac` and `alm`. A `codealmanac` compatibility bin remains for `npx codealmanac` bootstrap and older installs. Requires Node 20 or 22.

`init`, `capture`, `ingest`, and `garden` invoke your configured default provider unless `--using <provider[/model]>` overrides it. Codex is the built-in recommended default; Claude uses the bundled Claude Agent SDK, Codex uses `codex exec --json`, and Cursor is currently an explicit future-work adapter. The query commands (`search`, `show`, `health`, `topics`) need no credentials at all.

## Authentication

Pick the agent you want Almanac to use:

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
almanac agents use codex
almanac agents model codex gpt-5.3-codex

# Scriptable equivalent:
almanac config set agent.default codex
almanac config set agent.models.codex gpt-5.3-codex
almanac config set --project agent.default claude
```

Almanac itself never stores your provider credentials. Auth stays in each agent's normal local credential store.
User config lives in `~/.almanac/config.toml`; project agent defaults can live in `.almanac/config.toml`.

## Quickstart

```bash
npm install -g codealmanac
almanac                       # interactive setup wizard; choose provider + model
                              # (or: almanac --yes)

cd your-repo
almanac init                  # default provider reads the repo and builds the wiki

almanac search "auth"         # full-text search across pages
almanac show checkout-flow    # read a page

# From here on, just code as usual — the scheduler periodically runs
# `almanac capture sweep`, which writes and updates pages based on
# quiet Claude/Codex transcripts.
```

A wiki is scaffolded two ways: run `almanac init` yourself, or clone a repo that already has `.almanac/` committed (Almanac auto-registers it on the first query).

Sanity-check the install with `almanac doctor` and `almanac agents list` — they report binary location, native SQLite binding, provider readiness, automation status, guides, import line, and current-wiki stats.

New to Almanac? Read the [Concepts guide](./docs/concepts.md) for a walkthrough of pages, topics, files, the database, and the CLI.

## Commands

```bash
# Search & read
almanac search "auth"                        # full-text search across pages
almanac search --topic database              # filter by topic
almanac search --mentions src/lib/stripe.ts  # pages referencing a file
almanac show checkout-flow                   # read a page
almanac show checkout-flow --meta            # metadata only
almanac show checkout-flow --body            # body only

# Organize
almanac topics list                          # all topics with page counts
almanac topics show database --descendants   # topic + its subtree
almanac tag <page> <topic...>                # add topics to a page
almanac health                               # graph integrity report

# Wiki lifecycle
almanac init --using codex                   # build a new wiki from the repo
almanac capture --using claude <transcript>  # update wiki from a session transcript
almanac capture --json <transcript>          # structured CommandOutcome output
almanac capture sweep                        # scan quiet Claude/Codex transcripts
almanac ingest docs/adr.md                   # absorb files or folders into the wiki
almanac garden                               # audit and improve the wiki
almanac jobs                                 # list local background runs
almanac automation install                   # install 5h scheduled auto-capture
almanac automation install --every 2h        # customize the sweep interval
almanac automation status                    # show scheduler status

# Setup & diagnose
almanac agents list                          # provider readiness + default
almanac agents use codex                     # restore the recommended default provider
almanac agents model claude claude-opus-4-6  # set provider model
almanac config list --show-origin            # scriptable settings view
almanac doctor                               # check install + wiki health
almanac update                               # update to latest version
```

`init`, `capture`, `ingest`, and `garden` resolve provider settings through `--using <provider[/model]>`, then provider config.

Query commands stay pipe-friendly: use slug-only output for scripts and `--json`
for structured output. `almanac search --summaries` adds one-line page
summaries for scan-friendly terminal browsing; `--slugs` forces slug-only
output. Pipe with `--stdin`:

```bash
almanac search --topic flows --slugs | almanac show --stdin
almanac search --stale 90d | almanac tag --stdin needs-review
```

Run `almanac <command> --help` for the full flag surface.

## How capture works

Scheduled capture runs `almanac capture sweep`. The sweep scans Claude and Codex transcript stores, ignores transcripts older than the automation activation timestamp, ignores active transcripts until they have been quiet long enough, maps each transcript back to the nearest repo with `.almanac/`, and uses `.almanac/runs/capture-ledger.json` to remember which transcript lines/bytes were already captured. Capture still receives the original full transcript path; the sweep adds cursor guidance telling the agent where new material begins.

Manual `almanac capture <transcript>` works the same way as before: it resolves transcript inputs, builds the same Absorb operation used by `almanac ingest`, and starts a provider run through the process manager. The provider adapter decides how to express the requested prompt, tools, and future subagents for Claude, Codex, or Cursor.

Capture writes nothing if nothing in the session meets the notability bar — silence is a valid outcome.

No proposal files, no `--apply` step, no hardcoded reviewer/scout/researcher pipeline. The changes land in `git status` and you commit them like anything else.

### The notability bar

Every repo's `.almanac/README.md` contains a notability bar: the threshold for what deserves a page. The default is "non-obvious knowledge that will help a future agent" — decisions that took research, gotchas discovered through failure, cross-cutting flows, constraints not visible in code. The operation prompt consults the bar before writing. Edit the bar to match your repo's taste.

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

`v0.2.1`, pre-release. Node 20.x or 22.x. Release process is documented in [RELEASE.md](./RELEASE.md). Breaking changes are possible before 1.0; they will be called out in release notes.
## Philosophy

Intelligence lives in the prompt, not in the pipeline. Whenever a task calls for judgment — deciding what from a session is worth capturing, evaluating a proposal against the graph, picking between editing and archiving — Almanac hands a concrete-but-open prompt to an agent. It does not wrap agents in propose/review/apply state machines, intermediate proposal files, or `--dry-run` rehearsal flags. The CLI finds and organizes; the agents do the thinking. If a future change can be expressed as a longer prompt or as more pipeline code, the prompt almost always wins.

## Contributing

Almanac is open source under the MIT license. To set up a development environment:

```bash
git clone https://github.com/AlmanacCode/codealmanac.git
cd codealmanac
npm install
npm run build
npm link                  # makes `almanac`, `alm`, and compatibility `codealmanac` available globally
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
├── harness/            ← provider-neutral run specs and provider adapters
├── process/            ← local run records, logs, background jobs
├── operations/         ← build, absorb, and garden operation specs
├── agent/              ← provider setup/status helpers and prompt loading
├── paths.ts            ← find nearest .almanac/ (like git finds .git/)
└── slug.ts             ← kebab-case canonicalization
```

## Status

v0.1.10, pre-release. Node 20.x or 22.x. Release process is documented in [RELEASE.md](./RELEASE.md). Breaking changes are possible before 1.0; they will be called out in release notes.

## Related

Almanac is part of the [OpenAlmanac](https://www.openalmanac.org) family. OpenAlmanac is a knowledge base for curious people; Almanac is knowledge for codebases. Same writing standards, different reader.

## License

MIT. Copyright (c) 2026 Rohan Sheth. See [LICENSE](./LICENSE).

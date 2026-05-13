<p align="center">
  <img src="viewer/readme-hero.png" alt="Almanac — A living wiki for your codebase">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codealmanac"><img alt="npm version" src="https://img.shields.io/npm/v/codealmanac?label=npm&color=2ea043"></a>
  <a href="https://www.npmjs.com/package/codealmanac"><img alt="npm downloads" src="https://img.shields.io/npm/dt/codealmanac?label=npm%20downloads&color=1f6feb"></a>
  <img alt="Node support" src="https://img.shields.io/badge/node-20%20%7C%2022%2B-1f6feb">
  <a href="./LICENSE"><img alt="License: PolyForm Noncommercial" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-df7b40"></a>
  <a href="https://github.com/AlmanacCode/codealmanac"><img alt="GitHub repository" src="https://img.shields.io/badge/GitHub-AlmanacCode%2Fcodealmanac-24292f?logo=github"></a>
</p>

A living wiki for your codebase, maintained by AI agents. Almanac documents the things code cannot say: decisions, flows, invariants, gotchas, and why the system is shaped the way it is.

## Quickstart

```bash
npx codealmanac

cd your-repo
almanac init

almanac search "auth"
almanac show checkout-flow
```

That is the whole first path: install Almanac, build the first wiki for a repo, then search and read it. From then on, scheduled capture periodically runs `almanac capture sweep` and updates `.almanac/pages/` from quiet Claude/Codex transcripts.

Prefer the explicit install?

```bash
npm install -g codealmanac
almanac
```

Requires Node 20, or Node 22 and newer. The npm package is `codealmanac`; the commands are `almanac` and `alm`.

## Choose Your Path

| You want to... | Run |
|---|---|
| Install and run guided setup | `npx codealmanac` |
| Install globally yourself | `npm install -g codealmanac && almanac` |
| Build a new wiki in a repo | `almanac init` |
| Search an existing wiki | `almanac search "query"` |
| Check setup and provider auth | `almanac doctor` |
| See scheduled capture status | `almanac automation status` |

## Why Almanac

AI coding agents can read code and explain what it does. They usually cannot recover why an implementation exists, what broke before, which invariants matter, or how one workflow crosses several files and services.

Almanac gives agents durable project memory:

- **Atomic pages**: one markdown page per stable concept, flow, decision, or gotcha.
- **Code-aware search**: find pages that mention a file or folder before editing it.
- **Topic graph**: organize pages into a DAG instead of one huge root instruction file.
- **Scheduled capture**: absorb quiet AI coding transcripts into the wiki after work settles.
- **Local-only storage**: pages live in `.almanac/` inside the repo; the global registry stays under `~/.almanac/`.
- **Git-reviewed output**: wiki edits show up in `git status` like any other change.

## What Gets Created

```text
your-repo/
|-- src/
|-- .almanac/
|   |-- pages/
|   |   |-- supabase.md
|   |   |-- checkout-flow.md
|   |   `-- uuid-decision.md
|   |-- topics.yaml
|   `-- index.db          # generated SQLite index
|-- .git/
`-- ...
```

The markdown pages are the source of truth. `index.db` is a derived cache used by query commands.

## How It Works

Almanac has two kinds of commands:

- **Write-capable lifecycle commands**: `init`, `capture`, `ingest`, and `garden` can invoke your configured AI provider.
- **Local query and organization commands**: `search`, `show`, `topics`, `tag`, `health`, `list`, `jobs`, and `automation` operate on local files, SQLite, or run records.

Scheduled auto-capture runs `almanac capture sweep`. The sweep scans Claude and Codex transcript stores, ignores transcripts from before automation was enabled, waits for active transcripts to become quiet, maps each transcript back to the nearest repo with `.almanac/`, and starts ordinary background capture jobs for new material.

Capture writes nothing if nothing in the session meets the notability bar. Silence is a valid outcome.

## Setup And Auth

Bare `almanac` opens the setup wizard. It chooses your default agent/model, checks readiness, installs scheduled auto-capture, and adds optional agent guides.

Useful unattended setup flags:

```bash
almanac setup --yes
almanac setup --skip-automation
almanac setup --skip-guides
almanac setup --auto-capture-every 2h
almanac setup --auto-capture-quiet 30m
```

Pick the provider Almanac should use for write-capable commands:

```bash
# Claude
claude auth login --claudeai
# or:
export ANTHROPIC_API_KEY=sk-ant-...

# Codex
codex login

# Cursor
cursor-agent login

# Verify provider readiness
almanac agents list
almanac doctor
```

Codex is the built-in recommended default. Claude uses the bundled Claude Agent SDK, Codex uses `codex app-server`, and Cursor is currently a future-work adapter. Query commands do not need provider credentials.

Almanac never stores provider credentials. Auth stays in each provider's normal local credential store. User config lives in `~/.almanac/config.toml`; project defaults can live in `.almanac/config.toml`.

## Core Commands

| Command | Purpose |
|---|---|
| `almanac init` | Build the first wiki for the current repo. |
| `almanac search "auth"` | Full-text search over wiki pages. |
| `almanac search --mentions src/auth/` | Find pages that reference a file or folder. |
| `almanac show checkout-flow` | Read one page. |
| `almanac topics list` | Show the topic graph. |
| `almanac tag <page> <topic...>` | Add topics to a page. |
| `almanac health` | Check wiki graph integrity. |
| `almanac capture <transcript>` | Manually absorb a session transcript. |
| `almanac capture sweep --dry-run --json` | Preview scheduled-capture candidates. |
| `almanac ingest docs/adr.md` | Absorb files or folders into the wiki. |
| `almanac garden` | Audit and improve the wiki graph. |
| `almanac jobs` | List local background runs. |
| `almanac automation install --every 2h` | Install or adjust scheduled capture. |
| `almanac doctor` | Check install, providers, automation, and wiki health. |

Run `almanac <command> --help` for the full flag surface.

## Common Workflows

**Before editing a subsystem**

```bash
almanac search --mentions src/checkout/
almanac search "checkout timeout"
almanac show checkout-flow
```

**Pipe wiki pages through local commands**

```bash
almanac search --topic flows --slugs | almanac show --stdin
almanac search --stale 90d | almanac tag --stdin needs-review
```

**Inspect scheduled capture**

```bash
almanac automation status
almanac capture sweep --dry-run --json
almanac jobs
```

## Concepts

Every repo's `.almanac/README.md` defines the notability bar: the threshold for what deserves a page. The default is "non-obvious knowledge that will help a future agent": decisions that took research, gotchas discovered through failure, cross-cutting flows, and constraints not visible in code.

Links use one syntax:

```markdown
[[checkout-flow]]              # page link
[[src/checkout/handler.ts]]    # file reference
[[src/checkout/]]              # folder reference
[[openalmanac:supabase]]       # cross-wiki reference
```

Most wiki changes are edits in place. When a page's central decision is reversed, the old page can be archived with `archived_at` and `superseded_by`, while the replacement page uses `supersedes`.

Read the [Concepts guide](./docs/concepts.md) for pages, topics, files, the database, and the CLI model.

## Multi-Wiki

Each repo has its own `.almanac/`. The global registry at `~/.almanac/registry.json` tracks every wiki on the machine.

```bash
almanac list
almanac search --wiki openalmanac "RLS"
```

Cloning a repo that already has `.almanac/` committed auto-registers it on the first Almanac command. Unreachable registry entries are skipped rather than failing global queries.

## Contributing

```bash
git clone https://github.com/AlmanacCode/codealmanac.git
cd codealmanac
npm install
npm run build
npm link
npm test
```

The codebase is TypeScript, built with [tsup](https://tsup.egoist.dev/), tested with [Vitest](https://vitest.dev/), and backed by [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). Release steps live in [RELEASE.md](./RELEASE.md).

## Star History

[![Star History Chart](https://api.star-history.com/chart?repos=AlmanacCode/codealmanac&type=date&legend=top-left)](https://www.star-history.com/?repos=AlmanacCode%2Fcodealmanac&type=date&legend=top-left)

## Status

`v0.2.21`, pre-1.0. Breaking changes are possible before 1.0 and will be called out in release notes.

## License

PolyForm Noncommercial License 1.0.0. Commercial use requires a separate paid commercial license; see [COMMERCIAL.md](./COMMERCIAL.md). See [LICENSE](./LICENSE).

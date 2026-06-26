<p align="center">
  <img src="viewer/readme-hero.png" alt="Almanac — A living wiki for your codebase">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codealmanac"><img alt="npm version" src="https://img.shields.io/npm/v/codealmanac?label=npm&color=2ea043"></a>
  <a href="https://www.npmjs.com/package/codealmanac"><img alt="npm downloads" src="https://img.shields.io/npm/dt/codealmanac?label=npm%20downloads&color=1f6feb"></a>
  <a href="https://github.com/AlmanacCode/codealmanac/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/AlmanacCode/codealmanac/ci.yml?branch=main&label=ci"></a>
  <a href="https://github.com/AlmanacCode/codealmanac/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/AlmanacCode/codealmanac?style=flat&logo=github"></a>
  <a href="https://github.com/AlmanacCode/codealmanac/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/AlmanacCode/codealmanac"></a>
  <img alt="Node support" src="https://img.shields.io/badge/node-20%20%7C%2022%2B-1f6feb">
  <a href="./LICENSE.md"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-df7b40"></a>
  <a href="https://usealmanac.com/code"><img alt="Website" src="https://img.shields.io/badge/website-usealmanac.com%2Fcode-24292f"></a>
</p>

Almanac gives AI coding agents durable project memory. It turns the decisions, flows, invariants, and gotchas from real engineering sessions into a local wiki that lives with your repo.

Use it when code answers "what exists" but not "why it exists," when a new agent needs subsystem context before editing, or when important implementation knowledge keeps disappearing into old chat transcripts.

## Who This Is For

- Teams using AI coding agents across long-lived repositories.
- Maintainers who want decisions and gotchas captured next to the code.
- Agents that need searchable project memory before changing a subsystem.
- Developers who prefer local files, git review, and scriptable CLI workflows over hosted documentation silos.

## Why Almanac Exists

AI agents are good at reading code in the moment. They are worse at carrying forward the hidden context from previous sessions: why a fallback exists, what broke last time, which files move together, and which constraints matter.

Almanac makes that context durable. It stores atomic markdown pages in `.almanac/`, indexes them locally, and lets agents search the wiki before they edit.

## Quickstart

```bash
npx codealmanac

cd your-repo
# create or update the repo wiki from https://codealmanac.com/dashboard

almanac search "auth"
almanac show checkout-flow
```

That is the happy path: install Almanac locally, create the repo wiki from the dashboard, then use the CLI to search and read it from your agent. OSS-only users can still run `almanac init` and `almanac automation install` manually.

Prefer the explicit install?

```bash
npm install -g codealmanac
almanac
```

Requires Node 20, or Node 22 and newer. The npm package is `codealmanac`; the commands are `almanac` and `alm`.

## Try The Sample Wiki

Want to see the shape before running an agent over your own repo?

```bash
git clone https://github.com/AlmanacCode/codealmanac.git
cd codealmanac/examples/sample-repo

npx codealmanac search "checkout"
npx codealmanac search --mentions src/checkout.ts
npx codealmanac show checkout-flow
```

<p align="center">
  <img src="viewer/readme-sample-wiki.png" alt="Terminal showing Almanac search and show commands against the sample wiki">
</p>

The sample wiki shows the checked-in `.almanac/` files directly: a notability guide, topics, and two short pages that document a flow and a gotcha.

## Choose Your Path

| You want to... | Run |
|---|---|
| Install and run guided setup | `npx codealmanac` |
| Install globally yourself | `npm install -g codealmanac && almanac` |
| Create a repo wiki | `https://codealmanac.com/dashboard` |
| Search an existing wiki | `almanac search "query"` |
| Initialize locally without the dashboard | `almanac init` |
| Check setup and provider auth | `almanac doctor` |
| See scheduled sync status | `almanac automation status` |

## What Almanac Gives You

AI coding agents can read code and explain what it does. They usually cannot recover why an implementation exists, what broke before, which invariants matter, or how one workflow crosses several files and services.

Almanac gives agents durable project memory:

- **Atomic pages**: one markdown page per stable concept, flow, decision, or gotcha.
- **Code-aware search**: find pages that mention a file or folder before editing it.
- **Topic graph**: organize pages into a DAG instead of one huge root instruction file.
- **Scheduled maintenance**: sync quiet AI coding transcripts and periodically maintain the wiki graph.
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

- **Write-capable lifecycle commands**: `init`, `absorb`, `sync`, and `garden` can invoke your configured AI provider. `ingest` is an alias for `absorb`.
- **Local query and organization commands**: `search`, `show`, `topics`, `tag`, `health`, `list`, `jobs`, and `automation` operate on local files, SQLite, or job records.

Scheduled automation runs `almanac sync` and `almanac garden`. Sync scans Claude and Codex transcript stores, ignores transcripts from before automation was enabled, waits for active transcripts to become quiet, maps each transcript back to the nearest repo with `.almanac/`, and starts ordinary background Absorb jobs for new material. Garden periodically maintains the wiki graph.

Absorb writes nothing if the input does not meet the notability bar. Silence is a valid outcome.

## Setup And Auth

Bare `almanac` opens the setup wizard. It chooses your default agent/model, checks readiness, installs the local agent guides, and asks whether to keep the CLI updated automatically.

Setup no longer installs scheduled sync or Garden automation by default. Create the repo's wiki from the dashboard, then use the CLI to query it locally. Sync and Garden remain available through `almanac automation install` and the explicit setup flags below.

Useful unattended setup flags:

```bash
almanac setup --yes
almanac setup --skip-automation
almanac setup --skip-guides
almanac setup --auto-commit
almanac setup --no-auto-commit
almanac setup --sync-every 2h
almanac setup --sync-quiet 30m
almanac setup --garden-every 4h
almanac setup --garden-off
almanac setup --auto-update
almanac setup --auto-update-every 1d
```

Interactive setup asks about CLI self-update and defaults to yes. Unattended setup uses the same default unless `--skip-automation` is present.

Auto-commit is off by default. Use `--auto-commit` only when lifecycle runs
should commit wiki source changes automatically.

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
| `almanac absorb docs/adr.md github:pr:123` | Update the wiki from explicit files, folders, PRs, issues, or URLs. |
| `almanac sync status --json` | Show scheduled sync candidates. |
| `almanac ingest docs/adr.md` | Alias for `almanac absorb docs/adr.md`. |
| `almanac garden` | Maintain the wiki graph. |
| `almanac jobs` | List local background runs. |
| `almanac update` | Check npm and install the latest Almanac if one is available. |
| `almanac automation install --every 2h` | Install or adjust scheduled sync and Garden. |
| `almanac automation install update --every 1d` | Install scheduled Almanac self-update. |
| `almanac doctor` | Check install, providers, automation, and wiki health. |

Query commands and attached lifecycle runs are quiet by default. Use `--verbose` when you want human-readable
context such as search summaries, page metadata, registry paths, or live agent tool activity. Run
`almanac <command> --help` for the full flag surface.

The default first build stays compact:

```bash
almanac init
# Analyzing codebase... This usually takes 5-10 minutes.
# init finished: run_...
# Browse the wiki: almanac serve
```

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

**Inspect scheduled automation**

```bash
almanac automation status
almanac sync status --json
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

The codebase is TypeScript, built with [tsup](https://tsup.egoist.dev/), tested with [Vitest](https://vitest.dev/), and backed by [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Release steps live in [RELEASE.md](./RELEASE.md).

If Almanac helps your agents understand a codebase faster, please consider giving the repo a star.

## Star History

[![Star History Chart](https://api.star-history.com/chart?repos=AlmanacCode/codealmanac&type=date&legend=top-left)](https://www.star-history.com/?repos=AlmanacCode%2Fcodealmanac&type=date&legend=top-left)

## Status

Almanac is pre-1.0. Breaking changes are possible before 1.0 and will be called out in release notes.

## License

Apache License 2.0. See [LICENSE.md](./LICENSE.md).

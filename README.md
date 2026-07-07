<p align="center">
  <img src="docs/assets/readme-hero.png" alt="CodeAlmanac - A living wiki for your codebase">
</p>

<p align="center">
  <a href="https://pypi.org/project/codealmanac/"><img alt="PyPI version" src="https://img.shields.io/pypi/v/codealmanac?label=pypi&color=ef6c35"></a>
  <a href="https://pepy.tech/projects/codealmanac"><img alt="PyPI downloads" src="https://static.pepy.tech/badge/codealmanac"></a>
  <a href="https://github.com/AlmanacCode/codealmanac"><img alt="GitHub stars" src="https://img.shields.io/github/stars/AlmanacCode/codealmanac?style=social"></a>
  <a href="https://discord.com/invite/jjuxtrGvJ"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white"></a>
  <a href="https://www.linkedin.com/company/codealmanac/"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-CodeAlmanac-0A66C2?logo=linkedin&logoColor=white"></a>
  <a href="https://www.ycombinator.com"><img alt="Y Combinator S26" src="https://img.shields.io/badge/Y%20Combinator-S26-f26625?logo=ycombinator&logoColor=white"></a>
  <a href="./LICENSE.md"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-df7b40"></a>
</p>

# CodeAlmanac

A living wiki for your codebase, maintained by AI coding agents.

CodeAlmanac gives AI agents the context code alone cannot hold: why a system is
shaped the way it is, what broke before, which invariants matter, and how
workflows cross files and services. The wiki is plain markdown in your repo,
indexed locally, and reviewed in Git like any other code change.

## Quickstart

```bash
curl -fsSL https://codealmanac.com/install.sh | sh
codealmanac setup --yes

cd your-repo
codealmanac init                     # Makes your wiki, if you don't have one
codealmanac search "getting started" # Shows matching wiki pages.
codealmanac show getting-started     # Opens one page in the terminal
codealmanac serve                    # Shows the wiki in local web viewer.
```

## Install

With the install script:

```bash
curl -fsSL https://codealmanac.com/install.sh | sh
```

or directly:

```bash
uv tool install codealmanac@latest
```

or:

```bash
python -m pip install codealmanac
```

From this checkout:

```bash
uv sync
uv run codealmanac --help
```

Requires Python 3.12+.

## Setup

Install global agent instructions for the local tools you use:

```bash
codealmanac setup --yes
codealmanac setup --yes --target codex
codealmanac setup --yes --target claude
```

Plain setup installs local agent instructions plus the default local automation:
sync, Garden, and daily package update. It does not connect to a hosted service.

`--yes` picks Codex as the AI runner. If you don't have Codex or prefer Claude:

```bash
codealmanac setup --yes --runner claude
```

Other setup flags:

```bash
codealmanac setup --yes --sync-every 5h
codealmanac setup --yes --sync-off
codealmanac setup --yes --garden-off
codealmanac setup --yes --no-auto-update
```

To uninstall CodeAlmanac-owned local artifacts:

```bash
codealmanac uninstall --yes
```

## Daily Read Surface

Agents and humans use the same local read commands:

```bash
codealmanac search "checkout timeout"
codealmanac search --mentions src/checkout/
codealmanac show checkout-flow
codealmanac topics
codealmanac health
codealmanac validate
```

Use `--wiki <name>` to read another registered local wiki. By default,
commands target the exact current directory when it is a registered repository
root.

## Updating The Wiki

Lifecycle commands can ask a configured local agent harness to edit wiki pages.
They only allow source edits under `almanac/`.

```bash
codealmanac ingest README.md --using codex
codealmanac ingest github:pr:123 --using claude
codealmanac garden --using codex
```

`ingest` folds selected local material into the wiki. Inputs can include files,
directories, Git diffs, commit ranges, GitHub PRs or issues, URLs, and local
agent transcripts.

`garden` improves the existing wiki graph: stale pages, links, topics, weak
leads, duplicate pages, and unsupported claims.

No-op is valid. If the material adds no durable wiki knowledge, the harness
should leave the wiki unchanged.

`ingest` and `garden` create queued runs and start a local worker. Use
`codealmanac jobs` and `codealmanac jobs attach <run-id>` to follow them.

## Sync And Automation

`sync` scans local Claude and Codex transcript stores, finds conversations active
since the last completed sync, and queues ordinary local ingest runs.

```bash
codealmanac sync status --from codex
codealmanac sync --from codex --using codex
codealmanac automation install sync --every 5h
codealmanac automation install update --every 24h
codealmanac automation status
```

Scheduled automation launches local `sync`, `garden`, or `update` commands with
explicit unattended policy. It is local scheduler state, not cloud sync.
Scheduler logs live under `~/.codealmanac/logs/`.

## Jobs

Lifecycle runs are recorded under `~/.codealmanac/`:

```bash
codealmanac jobs
codealmanac jobs show <run-id>
codealmanac jobs logs <run-id>
codealmanac jobs attach <run-id>
codealmanac jobs cancel <run-id>
```

Run logs include source-resolution facts, harness events, safety errors, and
terminal status.

## Providers

CodeAlmanac currently supports local Codex app-server and Claude Agent SDK
harnesses.

```bash
codex login
claude auth login
codealmanac doctor
```

Read commands do not need provider credentials. Write-capable lifecycle
commands need the selected harness to be available and authenticated.

## What Gets Created By Init

With the default root:

```text
your-repo/
|-- almanac/
|   |-- README.md
|   |-- topics.yaml
|   |-- architecture/
|   |   |-- README.md
|   |   `-- indexer.md
|   |-- decisions/
|   |   `-- local-first.md
|   `-- guides/
|       `-- setup.md
|-- src/
`-- ...
```

Markdown pages live directly under `almanac/` in meaningful folders.
`topics.yaml` organizes pages across folders. `README.md` files act as landing
pages for their folder routes.

For auto-detection, a repository counts as a CodeAlmanac wiki when
`almanac/topics.yaml` and `almanac/README.md` exist.

## Runtime State

Derived local state lives under `~/.codealmanac/`:

```text
~/.codealmanac/codealmanac.db
~/.codealmanac/repos/<repo-id>/index.db
```

The local database records repositories, runs, run events, worker locks, and
sync state. Per-repository runtime files contain derived indexes. They do not
belong in the committed `almanac/` tree.

## Configuration

User config lives at:

```text
~/.codealmanac/config.toml
```

Project config lives at:

```text
almanac/config.toml
```

The first supported defaults are:

```toml
auto_commit = true

[harness]
default = "codex"
```

CLI flags still win over config.

`auto_commit` means lifecycle prompts may tell the selected agent to use normal
Git commands for wiki source changes. CodeAlmanac does not stage files, split
diffs, or commit internally.

```bash
codealmanac setup --no-auto-commit
codealmanac config set auto_commit false
codealmanac config set auto_commit true
```

## Local Viewer

```bash
codealmanac serve
```

The viewer is read-only. It renders pages, search, topics, backlinks, and
file-reference navigation from local wiki data. By default it can switch across
available registered local wikis. Use `codealmanac serve --wiki <name>` to
narrow the viewer to one wiki.

## Current Contract

This rewrite is local-only for now.

- Public command: `codealmanac`
- Repo wiki root: `almanac/` only
- Alternate repo wiki roots: none
- User state root: `~/.codealmanac/`
- Runtime: Python 3.12+
- Storage: local markdown plus derived state under `~/.codealmanac/`
- No hosted login/connect/upload commands.
- No public SDK or MCP package.
- No compatibility aliases.
- No alternate wiki roots.
- No hidden cloud write path.
- No second wiki command name.

This is the Python/PyPI product surface. Hosted integration can be added later
around the same repo-owned wiki artifact, but it is not part of this release
surface.

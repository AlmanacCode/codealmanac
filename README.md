# CodeAlmanac

CodeAlmanac is a codebase wiki maintained by AI coding agents.

It keeps durable project knowledge next to the code: decisions, workflows,
invariants, incidents, gotchas, and context from real engineering sessions.
The wiki is markdown in your repository, backed by a local SQLite index for
fast search.

## Current Status

This Python rewrite is usable as a local alpha. It is not the old Node CLI.
Cloud setup is the default CLI path; local setup remains available under the
`local` namespace.

- Public command: `codealmanac`
- Default repo wiki root: `almanac/`
- Common alternate repo wiki root: `docs/almanac/`
- Custom repo wiki roots: any safe repo-relative directory via `--root`
- User state root: `~/.codealmanac/`
- Runtime: Python 3.12+
- Storage: local markdown plus a derived SQLite index

## Install

From a published package:

```bash
uv tool install codealmanac
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

## Setup

Sign in to CodeAlmanac cloud and install global agent instructions for the
local tools you use:

```bash
codealmanac setup --yes
codealmanac setup --yes --target codex
codealmanac setup --yes --target claude
codealmanac login
codealmanac whoami
codealmanac capture status
codealmanac capture enable --target codex
```

Use `--skip-login` when you only want local instruction files. Scheduled
automation is explicit:

```bash
codealmanac setup --yes --skip-login
codealmanac setup --yes --install-automation
codealmanac setup --yes --sync-every 5h --sync-quiet 45m
codealmanac setup --yes --install-automation --garden-off
```

`--install-automation` installs local scheduled `sync` and `garden` jobs.
Passing `--sync-every`, `--sync-quiet`, `--garden-every`, or `--garden-off`
also opts into automation installation.

To remove setup-owned instruction artifacts and scheduled automation:

```bash
codealmanac logout
codealmanac uninstall --yes
codealmanac uninstall --yes --keep-automation
```

## Quickstart

Inside a repository:

```bash
codealmanac init
codealmanac search "getting"
codealmanac show getting-started
codealmanac serve
```

`init` creates a local wiki scaffold under the configured Almanac root. New
repos default to `almanac/`. Use `--root docs/almanac`, `--root .almanac`, or
another repo-relative directory when a project needs a different location.

## Daily Read Surface

Agents and humans use the same local read commands:

```bash
codealmanac search "checkout timeout"
codealmanac search --mentions src/checkout/
codealmanac show checkout-flow
codealmanac topics
codealmanac health
```

Use `--wiki <name>` to read another registered local wiki. By default,
commands resolve the nearest repository wiki from the current directory.

## Updating The Wiki

Local update commands can ask a configured agent harness to edit wiki pages.
They only allow changes under the configured Almanac root. Configure the
current checkout and maintained branch first:

```bash
codealmanac local setup --branch main
codealmanac local update --using codex
codealmanac local triggers enable dev --delivery commit
codealmanac local jobs list
```

`local setup` stores repository and branch policy in
`~/.codealmanac/control.sqlite` and installs local Git trigger hooks unless
`--skip-hooks` is passed.

`local update` records a manual trigger for the current configured branch and
runs the same local worker path used by Git hooks.

No-op is valid. If the available source material adds no durable wiki
knowledge, the harness should leave the wiki unchanged.

## Sync And Automation

`sync` scans local Claude and Codex transcript stores, waits for quiet sessions,
and runs ordinary local lifecycle jobs for eligible transcript ranges.

```bash
codealmanac sync status --from codex
codealmanac sync --from codex --using codex
codealmanac sync --from codex --using codex --background
codealmanac automation install sync --every 5h --quiet 30m
codealmanac automation status
```

Scheduled automation launches foreground `sync` and local maintenance commands
with explicit unattended policy. It is local scheduler state, not cloud sync.
Use `sync --background` for manual queue-and-worker execution.

## Jobs

Lifecycle runs are recorded under the configured Almanac root:

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
|   |-- pages/
|   |-- manual/
|-- src/
`-- ...
```

Markdown pages, `topics.yaml`, and manual files are the wiki source. `init`
also writes `.gitignore` entries for runtime artifacts.

For auto-detection, a folder counts as a CodeAlmanac wiki only when it has both
`topics.yaml` and `pages/`. `README.md` alone is not a wiki marker.

## Runtime State

Derived local state appears when commands need it:

```text
almanac/index.db
almanac/index.db-wal
almanac/index.db-shm
~/.codealmanac/jobs/<workspace-id>/
```

Those runtime files are rebuildable local machine state and should stay out of
commits.

## Configuration

User config lives at:

```text
~/.codealmanac/config.toml
```

Project config lives at:

```text
<almanac-root>/config.toml
```

The first supported defaults are:

```toml
[harness]
default = "codex"

[sync]
quiet = "30m"
```

CLI flags still win over config.

## Local Viewer

```bash
codealmanac serve
```

The viewer is read-only. It renders pages, search, topics, backlinks, and
file-reference navigation from local wiki data. By default it can switch across
available registered local wikis. Use `codealmanac serve --wiki <name>` to
narrow the viewer to one wiki.

## Public Contract

This rewrite has two public surfaces:

- Cloud commands: `setup`, `login`, `whoami`, `logout`, `capture`.
- Local commands: `local setup`, `local update`, `local triggers`, `local jobs`.
- No public SDK or MCP package.
- No compatibility aliases.
- No hidden cloud write path.
- No second wiki command name.

Cloud setup uses hosted CLI auth. Local setup uses local Git checkout state.

# CodeAlmanac

CodeAlmanac is a local codebase wiki maintained by AI coding agents.

It keeps durable project knowledge next to the code: decisions, workflows,
invariants, incidents, gotchas, and context from real engineering sessions.
The wiki is markdown in your repository, backed by a local SQLite index for
fast search.

## Current Status

This Python rewrite is usable as a local alpha. It is not the old Node CLI and
it does not require a hosted service.

- Public command: `codealmanac`
- Default repo wiki root: `almanac/`
- Optional roots: `docs/almanac/` or `.almanac/`
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

## Quickstart

Inside a repository:

```bash
codealmanac init
codealmanac search "getting"
codealmanac show getting-started
codealmanac serve
```

`init` creates a local wiki scaffold under the configured Almanac root. New
repos default to `almanac/`.

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

Lifecycle commands can ask a configured local agent harness to edit wiki pages.
They only allow changes under the configured Almanac root.

```bash
codealmanac ingest docs/adr.md --using codex
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

## Sync And Automation

`sync` scans local Claude and Codex transcript stores, waits for quiet sessions,
and runs ordinary local ingest for eligible transcript ranges.

```bash
codealmanac sync status --from codex
codealmanac sync --from codex --using codex
codealmanac automation install sync --every 5h --quiet 30m
codealmanac automation status
```

Scheduled automation launches foreground `sync` or `garden` commands with
explicit unattended policy. It is local scheduler state, not cloud sync.

## Jobs

Lifecycle runs are recorded under the configured Almanac root:

```bash
codealmanac jobs
codealmanac jobs show <run-id>
codealmanac jobs logs <run-id>
```

Run logs include source-resolution facts, harness events, safety errors, and
terminal status.

## Providers

CodeAlmanac currently supports local Codex and Claude CLI harnesses.

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

## Runtime State

Derived local state appears when commands need it:

```text
almanac/index.db
almanac/index.db-wal
almanac/index.db-shm
almanac/jobs/
```

Those runtime files are rebuildable local machine state and should stay out of
commits.

## Configuration

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
file-reference navigation from local wiki data.

## Public Contract

This rewrite is local-only for now.

- No hosted login/connect/upload commands.
- No public SDK or MCP package.
- No compatibility aliases.
- No hidden cloud write path.
- No second wiki command name.

Hosted integration can be added later around the same repo-owned wiki artifact,
but it is not part of this release surface.

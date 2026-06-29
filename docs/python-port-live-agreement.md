# CodeAlmanac Python Port Live Agreement

This file records the active agreement for the Python rewrite of CodeAlmanac.
It is the constraint document for future agents.

## Current Decisions

- 2026-06-29: Python v1 is a local product. Do not build hosted shipping,
  hosted CLI, login/connect/upload, SDK, or MCP in this rewrite.
- 2026-06-29: The branch may contain merged `dev` / `origin/dev` work that
  assumes hosted shipping. Treat that work as reference or archive material,
  not as product direction for this rewrite.
- 2026-06-29: The old TypeScript/Node implementation is archived under
  `archive/code/`. Use it as behavior reference, not as code to preserve.
- 2026-06-29: Public command and package language is `codealmanac`. Do not add
  public `almanac` or `alm` aliases for compatibility.
- 2026-06-29: Repo-owned wiki data stays in `.almanac/`.
- 2026-06-29: Follow Almanac's Python style: service symmetry, explicit request
  models, service-owned verbs, store-owned persistence, thin CLI edges.
- 2026-06-29: Local automation v1 installs scheduler jobs for foreground
  `sync` and `garden`. Do not schedule `update` until the Python `update`
  command and packaging policy exist.
- 2026-06-29: Source input has four local layers:
  `SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime`. Git source
  runtime uses the Git CLI through a source-runtime adapter. GitHub PR/issue
  runtime uses GitHub CLI through the same port. Transcript runtime uses
  local JSONL parsing through the same port. Web URL runtime uses a local HTTP
  and HTML/text adapter through the same port. Path file/directory runtime uses
  a local filesystem adapter through the same port.
- 2026-06-29: The local viewer's file route is a wiki-reference route:
  `/api/file?path=src/foo.py` returns pages that mention the file or folder
  reference. It does not read or preview repo file contents.
- 2026-06-29: Filesystem directory source runtime uses Git listing when the
  selected directory is inside a Git worktree, then falls back to the bounded
  Python/pathspec walk when Git cannot answer. This is runtime material
  selection, not a new source kind or source catalog.
- 2026-06-29: Git-listed filesystem directory runtime ranks changed and
  untracked files before unchanged files and annotates included files as
  `changed` or `unchanged` in the runtime tree. This is a prompt-material
  selection policy inside the filesystem adapter; it is not a durable
  `candidate` object.
- 2026-06-29: `manual/` is a local support package, not a public CLI surface.
  It contains bundled wiki-maintenance doctrine. `init` and `build` copy
  missing files into `.almanac/manual/`, prompts tell lifecycle agents to read
  those files, and `doctor` reports package/workspace manual readiness.

## Product Frame

CodeAlmanac maintains a repo-owned wiki for a codebase and the project world
around that codebase. It is not a code documentation generator.

The wiki can cover code, architecture, decisions, incidents, conversations, PR
context, team conventions, deployment constraints, product strategy, and other
durable knowledge that helps future work.

The durable artifact is the repository's `.almanac/` directory. Git remains the
system of record for wiki changes.

The Python rewrite is a fresh codebase. Use the old CodeAlmanac implementation
and Almanac's Python engine as references for behavior and structure. Do not
share Almanac's hosted engine as a dependency in v1.

## Repository Shape

Target root:

```text
src/codealmanac/
  app.py
  core/
  database/
  services/
  workflows/
  integrations/
  server/
  cli/
  prompts/
  manual/
```

`app.py` is the composition root. It wires services and integrations through
explicit dependencies.

`core/` holds shared errors, identifiers, path/text helpers, and tiny cross-cutting
models that do not belong to one service.

`database/` owns SQLite connections and migration application.

`services/` holds product nouns:

```text
services/
  workspaces/
  wiki/
  index/
  sources/
  runs/
  harnesses/
  automation/
  config/
  diagnostics/
  updates/
  viewer/
```

`workflows/` holds multi-service product verbs:

```text
workflows/
  build/
  ingest/
  garden/
  sync/
```

`integrations/` holds concrete outside-world adapters. Organize adapters by
the service boundary they implement, not as one flat external-tool list.

```text
integrations/
  workspaces/
    git/
  harnesses/
    codex/
    claude/
  sources/
    filesystem/
    git/
    github/
    transcripts/
    web/
  automation/
    scheduler/
  updates/
    package.py
```

Ports live near the service that owns the product contract:

```text
services/harnesses/ports.py
services/sources/ports.py
services/automation/ports.py
```

Concrete integrations implement those ports:

```text
integrations/harnesses/codex/adapter.py
integrations/harnesses/claude/adapter.py
integrations/sources/filesystem/adapter.py
integrations/sources/github/adapter.py
integrations/sources/transcripts/codex.py
integrations/automation/scheduler/launchd.py
```

Do not put product decisions inside integrations. An integration translates an
outside tool into service-owned models and errors.

`cli/` owns command parsing, rendering, stdout/stderr, and exit codes. It does
not own product decisions.

`manual/` owns bundled wiki-maintenance doctrine. It is read by prompts,
copied into `.almanac/manual/` by local build/init, and checked by diagnostics.
It does not add a public command.

## Python Service Symmetry

Inside a service package, use these names when needed:

```text
models.py      domain/read models
requests.py    service input contracts
ports.py       adapter protocols
store.py       CRUD/query persistence
records.py     row/model conversion
tables.py      migrations only
service.py     product verbs
```

Do not create empty files just to satisfy symmetry.

SQL belongs in `store.py`, `*_store.py`, or `tables.py`. `tables.py` defines
migrations only. Row conversion belongs in `records.py` or a store-owned helper.

Services own product verbs. Stores own CRUD/query. Integrations implement
service-owned ports. CLI and future hosted/server edges adapt.

Allowed dependency direction:

```text
cli/server
  -> app
    -> workflows
      -> services
        -> stores
        -> ports
          -> integrations
```

Do not make stores call services. Do not make integrations call services. Do
not make CLI contain product decisions.

## Service Ownership

| Service | Owns | Must Not Own |
|---|---|---|
| `workspaces` | repo root, `.almanac/` root, registry, path containment, local wiki selection, repo/worktree mutation observations | page parsing, source discovery, run execution policy |
| `wiki` | markdown page truth, frontmatter, topics, wikilinks, page writes, health inputs | trigger timing, harness execution, source discovery |
| `index` | SQLite read model, FTS, mentions, backlinks, query projections | markdown truth, agent execution |
| `sources` | source observations, source refs, fingerprints, local source state | deciding when AI runs, page writes |
| `runs` | run ledger, events, outputs, lifecycle state | source discovery, page parsing, provider transports |
| `harnesses` | normalized Codex/Claude task/session contracts and ports | run lifecycle, page writes, source catalog |
| `automation` | local trigger decisions, quiet windows, scheduler state | run internals, source parsing, provider transports |
| `config` | user/project config parsing and precedence | product workflows |
| `diagnostics` | doctor-style checks and readiness reports | mutation workflows |
| `updates` | local package update policy, installer detection, update command planning | scheduler state, hosted release management, package-manager subprocess mechanics |
| `viewer` | read-only local browser payloads, page/topic/search overview assembly, rendered markdown for the viewer | markdown source of truth, SQLite persistence, AI calls, jobs/review lifecycle |

## Workflows

Workflows coordinate services. They do not own durable schema unless a service
is missing.

`build` creates or refreshes the initial local wiki in `.almanac/`.

`ingest` updates the wiki from selected local material such as paths, PR refs,
diffs, commit ranges, notes, or transcript refs.

AI-backed ingest must be auditable before it becomes public CLI behavior. The
workflow requires Git change tracking, clean `.almanac/` state before the run,
and no non-wiki file mutation during harness execution. Dirty application files
may exist as source material if their observed state does not change during the
run.

`sync` scans supported local transcript stores, waits for quiet sessions, maps
material back to repos with `.almanac/`, and queues ordinary local ingest work.
It does not mean cloud sync.

`garden` maintains existing wiki structure, links, topics, stale pages, and page
quality. It may run without new source material.

## Source Model

`source` means raw material CodeAlmanac can learn from. It does not mean
"source of truth."

Authority depends on the claim:

- Code is authoritative for runtime behavior.
- Transcripts are authoritative for what was discussed.
- PRs are authoritative for review context.
- The wiki is the maintained synthesis.

Discovery answers: what material exists or changed?

Use answers: what material should this run use?

There is no durable `candidate` object in v1. Bundling is a run input selection,
not a discovered product entity.

Adding or discovering material does not imply a wiki update. Updating the wiki
is a separate `ingest`, `build`, `sync`, or `garden` workflow.

Page file/folder references belong to `wiki` and `index`, not to the source
catalog. `[[src/foo.py]]` and `[[src/foo/]]` power mentions search and health.

## CLI Contract

The v1 CLI is local-only.

```text
codealmanac init [path]
codealmanac list
codealmanac search [query]
codealmanac show <slug>
codealmanac topics
codealmanac health
codealmanac serve
codealmanac build
codealmanac reindex
codealmanac ingest <inputs...>
codealmanac sync
codealmanac sync status
codealmanac garden
codealmanac jobs
codealmanac automation install|status|uninstall
codealmanac doctor
codealmanac update
```

Commands run inside a repo resolve the nearest `.almanac/`, like Git resolves
`.git/`.

`codealmanac list` reads the local registry of known `.almanac/` repos.

Use `--wiki <name>` to target a different registered local wiki. Do not add
`codealmanac use <wiki>` in v1; sticky selection is hosted-style state and can
confuse agents.

There is no public `capture` verb. Conversation collection is part of `sync` or
a future explicit local source workflow.

There is no public `absorb` command. The public lifecycle word is `ingest`.

`codealmanac reindex` is the explicit escape hatch for rebuilding the derived
SQLite read model. Query commands may refresh the index implicitly and silently.

CLI commands are not internal APIs. Automation, workers, tests, and server
wrappers must call the same Python services/workflows that CLI dispatch
calls. They must not shell out to `codealmanac`.

Correct shape:

```python
app.workflows.sync.run(workspace_id, request)
app.workflows.ingest.run(workspace_id, request)
app.runs.record_event(workspace_id, request)
app.viewer.page(request)
```

Incorrect shape:

```python
subprocess.run(["codealmanac", "sync"])
subprocess.run(["codealmanac", "ingest", "..."])
subprocess.run(["codealmanac", "show", "..."])
```

## Feature Map

### MVP

| Area | Features |
|---|---|
| Install/name | `codealmanac` package and command only |
| Workspace | nearest repo resolution, local registry, path containment |
| Wiki | pages, frontmatter, topics, wikilinks, file/folder refs |
| Index | SQLite read model, FTS search, mentions, backlinks, health |
| Sources | transcript/path/Git/GitHub/web input contracts, local observations, and runtime snapshots |
| Runs | durable ledger, events, outputs, foreground/background jobs |
| Harnesses | Codex and Claude behind normalized ports |
| Workflows | `build`, `ingest`, `sync`, `garden` |
| Automation | local scheduled sync/garden |
| CLI | thin local command surface |
| Serve | local read-only wiki viewer |
| Update | foreground local package-manager update with conservative source-install refusal |

### Explicitly Out Of Scope For V1

| Area | Decision |
|---|---|
| Hosted product | Do not build hosted shipping now |
| Hosted CLI | No `login`, `connect`, `upload`, hosted `sources`, hosted `jobs` |
| SDK | No Python SDK package |
| MCP | No MCP server |
| Compatibility aliases | No public `almanac`, `alm`, or `absorb` |
| Semantic search | FTS and refs first |

## Non-Negotiables

- Public naming is `codealmanac`.
- `.almanac/` remains the repo-owned wiki artifact.
- Local v1 must not inherit hosted assumptions from merged `dev` or `origin/dev`.
- CLI edges stay thin.
- Services own product verbs.
- Stores own persistence.
- Integrations sit behind ports.
- Structured models beat loose dictionaries.
- No hidden `getattr` or dynamic attribute contracts for shaped data.
- No source-kind branches smeared across unrelated services.
- No CLI-shaped core.
- No AI-writing path outside explicit lifecycle workflows.
- SQLite remains the local read model for search, refs, topics, and health.
- File/folder mention queries use normalized paths and GLOB-safe matching.

## Open Decisions

1. Whether local `add` deserves a v1 command or should wait until source-pool
   behavior is concrete.
2. Resolved 2026-06-29: keep public `jobs` as the CLI inspection noun and use
   internal `runs` as the service that owns execution records, events, outputs,
   and lifecycle state.
3. Resolved 2026-06-29: `serve` is restored after the core CLI/read model,
   because the Python index can now support a read-only viewer without a second
   content model.

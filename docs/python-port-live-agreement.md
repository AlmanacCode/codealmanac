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
- 2026-06-29: The Python rewrite targets new CodeAlmanac users. Do not keep
  TypeScript-era backward compatibility, legacy aliases, legacy root
  migrations, or old frontmatter repair paths unless the user explicitly
  reopens that decision.
- 2026-06-29: "Frontmatter rewrite" means deterministic editing of current
  page metadata such as `topics:` while preserving page body text. It is not a
  compatibility layer for old page formats.
- 2026-06-29: Repo-owned wiki data lives under a configurable repo-local
  Almanac root. New Python installs default to `almanac/`, not `.almanac/`.
  Users may configure another root such as `docs/almanac/` or `.almanac/`.
  The chosen root owns committed wiki docs and local runtime artifacts,
  including the SQLite index, unless a future decision splits runtime state
  elsewhere.
- 2026-06-29: Follow Almanac's Python style: service symmetry, explicit request
  models, service-owned verbs, store-owned persistence, thin CLI edges.
- 2026-06-29: Local automation v1 installs scheduler jobs for foreground
  `sync` and `garden`. Manual `update` is a foreground package-manager command
  and has pip/uv non-editable install dogfood. Do not schedule `update` until
  an explicit update-notification policy exists.
- 2026-06-29: `sync` writes a durable pending ledger claim before it invokes
  Ingest. Active pending claims skip that transcript; stale pending claims
  surface as needs-attention; terminal success or failure clears the pending
  fields. This is foreground/scheduled sync safety, not a background
  worker/retry loop.
- 2026-06-29: `runs` owns lifecycle state transitions. Run records start as
  `queued`, workflows explicitly mark them `running`, and only terminal
  finish calls may move them to `done`, `failed`, or `cancelled`.
- 2026-06-29: Lifecycle workflows record returned harness status/output before
  mutation-safety validation and harness success validation. A failed harness
  run should leave an `output` event in `jobs logs` even when the terminal run
  error is a later safety failure.
- 2026-06-29: Sync pending claims store the run id plus claimed byte/line
  cursor. `sync status` reports active linked runs separately from terminal
  linked runs that need reconciliation. Foreground `sync` reconciles terminal
  linked runs against the run ledger before deciding whether newer transcript
  bytes still need Ingest.
- 2026-06-29: Scheduled sync is ordinary foreground `sync` launched by local
  automation with explicit unattended policy: a stable claim owner, pending
  timeout, and failed-attempt budget. Repeated failed transcript ingests stop
  at needs-attention instead of retrying forever.
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
- 2026-06-29: The local viewer renders Markdown through `markdown-it-py` token
  streams. Wikilink rewriting touches text inline tokens only; inline code and
  fenced code stay source text, and labels remain escaped by the renderer.
- 2026-06-29: `serve` should borrow UseAlmanac's visual language, not its
  hosted wiki information architecture. Keep CodeAlmanac's local wiki-first
  reading model: sidebar navigation, page/topic/search/file-reference graph
  movement, and a read-only local viewer over repo-owned pages. UseAlmanac's
  colors, shell polish, account-picker styling, and dashboard chrome are valid
  reference material. Its hosted wiki page list/search flow, account routes,
  billing/settings surfaces, and hosted wording are not the target shape for
  the local product.
- 2026-06-29: Treat the current UseAlmanac wiki page and search experience as
  a non-target reference for CodeAlmanac. The desired direction is the local
  viewer already explored here: persistent sidebar, direct page reading,
  topic/file/search movement, and wiki navigation that feels like a repo-local
  knowledge browser. The earlier CodeAlmanac sidebar shell is the interaction
  target. The design layer can borrow UseAlmanac polish, but the current
  UseAlmanac page list and search treatment should not be copied. The issue is
  not the wiki content model; it is the visual/product treatment around the
  wiki reader.
- 2026-06-29: Bulletproof React is a frontend architecture reference for
  `serve`, not a mandate to add React or Next.js immediately. Apply its
  principles as the viewer grows: feature boundaries, colocated API requests,
  shared UI primitives, direct imports over broad barrels, and browser-level
  tests. A Next.js viewer is allowed only if the static package-data viewer
  becomes harder to maintain than a small built frontend.
- 2026-06-29: The `serve` frontend can use static ES modules while it remains
  a small read-only viewer. `app.js` is the entrypoint; nested modules under
  `server/assets/viewer/` own API calls, hash routes, DOM components, and
  screen renderers. This is the current Bulletproof-inspired seam. Do not add
  React, Next.js, Vite, or a frontend build step until real UI complexity makes
  static package data harder to maintain.
- 2026-06-29: Filesystem directory source runtime uses Git listing when the
  selected directory is inside a Git worktree, then falls back to the bounded
  Python/pathspec walk when Git cannot answer. This is runtime material
  selection, not a new source kind or source catalog.
- 2026-06-29: Git-listed filesystem directory runtime ranks changed and
  untracked files before unchanged files and annotates included files as
  `changed` or `unchanged` in the runtime tree. This is a prompt-material
  selection policy inside the filesystem adapter; it is not a durable
  `candidate` object.
- 2026-06-29: Clean filesystem directory runtime uses semantic diversity
  inside the adapter: after changed/untracked files, bounded selection
  interleaves directory groups and prefers role-bearing files such as
  `service.py`, `adapter.py`, `app.py`, and `main.py`. Do not add a source
  pool, durable candidate object, or Ingest branching for this.
- 2026-06-29: `manual/` is a local support package, not a public CLI surface.
  It contains bundled wiki-maintenance doctrine. `init` and `build` copy
  missing files into `<almanac-root>/manual/`, prompts tell lifecycle agents to
  read those files, and `doctor` reports package/workspace manual readiness.
- 2026-06-29: `database/` owns SQLite connection setup and migration
  application. Product stores still own their SQL schemas and query semantics.
  The current `index.db` migration strategy is rebuild-on-version-change
  because the index is a derived read model from `<almanac-root>/pages/` and
  `topics.yaml`.
- 2026-06-29: `config` owns local user/project TOML parsing and precedence
  through `pydantic-settings`. The first config surface is intentionally
  narrow: user config and `<almanac-root>/config.toml` can set the default
  lifecycle harness and sync quiet window. CLI flags still win over config. Do
  not add a public `config` command, environment override system, secrets
  system, or hosted/account config surface until a later agreement requires it.
- 2026-06-29: The CLI edge is allowed to split by command domain as pressure
  appears. `doctor`, `update`, `jobs`, and `automation` now live under the
  admin dispatch/render edge; the root dispatcher delegates to that edge and
  keeps services/workflows as the product boundary.
- 2026-06-29: The SQLite index service separates projection writes from
  read-only views. `services/index/store.py` owns schema, migrations,
  freshness signatures, source loading, and replacement writes into
  `index.db`; `services/index/views.py` owns read-only query SQL and row-to-
  Pydantic view construction.
- 2026-06-29: Registry cleanup is explicit. `codealmanac list` remains the
  local wiki registry surface; `list --json` exposes availability status, and
  `list --drop <selector>` / `list --drop-missing` remove entries only when the
  user asks. Read commands do not silently prune missing workspaces.

## Product Frame

CodeAlmanac maintains a repo-owned wiki for a codebase and the project world
around that codebase. It is not a code documentation generator.

The wiki can cover code, architecture, decisions, incidents, conversations, PR
context, team conventions, deployment constraints, product strategy, and other
durable knowledge that helps future work.

The durable artifact is the repository's configured Almanac root. New installs
default to `almanac/`. Git remains the system of record for wiki changes.

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
copied into `<almanac-root>/manual/` by local build/init, and checked by
diagnostics. It does not add a public command.

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
| `workspaces` | repo root, configured Almanac root, registry, path containment, local wiki selection, repo/worktree mutation observations | page parsing, source discovery, run execution policy |
| `wiki` | markdown page truth, frontmatter, topics, wikilinks, page writes, health inputs | trigger timing, harness execution, source discovery |
| `index` | SQLite read model, FTS, mentions, backlinks, query projections | markdown truth, agent execution |
| `sources` | source observations, source refs, fingerprints, local source state | deciding when AI runs, page writes |
| `runs` | run ledger, events, outputs, lifecycle state transitions | source discovery, page parsing, provider transports |
| `harnesses` | normalized Codex/Claude task/session contracts and ports | run lifecycle, page writes, source catalog |
| `automation` | local trigger decisions, quiet windows, scheduler state | run internals, source parsing, provider transports |
| `config` | user/project config parsing and precedence | product workflows |
| `diagnostics` | doctor-style checks and readiness reports | mutation workflows |
| `updates` | local package update policy, installer detection, update command planning | scheduler state, hosted release management, package-manager subprocess mechanics |
| `viewer` | read-only local browser payloads, page/topic/search overview assembly, rendered markdown for the viewer | markdown source of truth, SQLite persistence, AI calls, jobs/review lifecycle |

The viewer's product shape is local wiki browsing. It may adopt UseAlmanac's
alpine visual system and shell styling, but it should not replace the existing
wiki sidebar/graph-navigation model with the hosted UseAlmanac wiki page-list
or search flow.

For frontend structure, read `docs/reference/bulletproof-react/CODEALMANAC.md`.
If `serve` remains a static asset bundle, mirror the same boundaries in plain
files: shared visual primitives, wiki-specific rendering, and API helpers
should stay distinct instead of becoming one unstructured script.

The current static module layout is:

```text
server/assets/app.js
server/assets/viewer/api.js
server/assets/viewer/routes.js
server/assets/viewer/components.js
server/assets/viewer/renderers.js
server/assets/viewer/main.js
```

## Workflows

Workflows coordinate services. They do not own durable schema unless a service
is missing.

`build` creates or refreshes the initial local wiki in the configured Almanac
root. New installs default to `almanac/`.

`ingest` updates the wiki from selected local material such as paths, PR refs,
diffs, commit ranges, notes, or transcript refs.

AI-backed ingest must be auditable before it becomes public CLI behavior. The
workflow requires Git change tracking, clean wiki-root state before the run,
and no non-wiki file mutation during harness execution. Dirty application
files may exist as source material if their observed state does not change
during the run.

`sync` scans supported local transcript stores, waits for quiet sessions, maps
material back to repos with a configured Almanac root, claims a transcript
range in the sync ledger, and starts ordinary local ingest work. It does not
mean cloud sync.

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
codealmanac init [path] [--root <repo-relative-path>]
codealmanac list
codealmanac search [query]
codealmanac show <slug>
codealmanac topics
codealmanac health
codealmanac serve
codealmanac build [path] [--root <repo-relative-path>]
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

Commands run inside a repo resolve the nearest configured Almanac root, like
Git resolves `.git/`.

`--root` is a setup-time option on `init` and `build`. It must be a
repo-relative directory. On first setup, omitting it means `almanac/`. Inside an
existing registered repo, omitting it means "keep the registered root."
`docs/almanac/` and `.almanac/` are valid only when explicitly selected or
already recorded in the local registry for that repo.

`codealmanac list` reads the local registry of known repos with configured
Almanac roots.

Use `--wiki <name>` to target a different registered local wiki. Do not add
`codealmanac use <wiki>` in v1; sticky selection is hosted-style state and can
confuse agents.

There is no public `capture` verb. Conversation collection is part of `sync` or
a future explicit local source workflow.

There is no public `absorb` command. The public lifecycle word is `ingest`.

`codealmanac reindex` is the explicit escape hatch for rebuilding the derived
SQLite read model. Query commands may refresh the index implicitly and silently.

`codealmanac sync` accepts local execution controls such as
`--claim-owner`, `--pending-timeout`, and `--max-failed-attempts`. Automation
uses them to make scheduled sync ownership and retry policy explicit.

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
- The configured Almanac root remains the repo-owned wiki artifact. New
  installs default to `almanac/`.
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

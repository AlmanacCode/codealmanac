# Python Port Ownership Map

Updated: 2026-06-29

This map turns `docs/python-port-live-agreement.md` into implementation
boundaries. If code needs a different boundary, update this file and record the
reason in `idea-evolution.md`.

## Dependency Direction

```text
cli/server
  -> app
    -> workflows
      -> services
        -> stores
        -> ports
          -> integrations
```

`src/codealmanac/app.py` is the composition root. CLI commands, automation
entrypoints, tests, and future server wrappers get an application object from
that root instead of constructing stores or adapters themselves.

## Services

| Service | Owns | First implementation pressure |
|---|---|---|
| `workspaces` | repo root detection, `.almanac/` root, registry, path containment, local wiki selection | `init`, current-repo queries, `--wiki` lookup |
| `wiki` | page files, frontmatter, topics, wikilinks, page writes, health inputs | `init`, `show`, page parsing for index |
| `index` | SQLite read model, FTS, mentions, backlinks, query projections | `search`, `show --links`, `health` |
| `sources` | source observations, source refs, fingerprints, local source state, source runtime snapshots, transcript discovery ports and typed transcript candidates | `SourceAddress`/`SourceRef`/`SourceBrief`/`SourceRuntime`, `SourceRuntimeAdapter`, `TranscriptDiscoveryAdapter`, `TranscriptCandidate`, ingest and sync inputs |
| `runs` | run ledger, events, outputs, lifecycle state, persisted harness transcript identity | `jobs` read surface, lifecycle workflows, future sync exclusion |
| `harnesses` | normalized Codex/Claude run contracts, provider transcript refs, and ports | `HarnessKind`/`RunHarnessRequest`/`HarnessRunResult`/`HarnessTranscriptRef`/`HarnessAdapter`, later `build`, `ingest`, `garden` |
| `automation` | local scheduler decisions, quiet windows, installed task state | `AutomationTask`/`ScheduledJob`/`SchedulerAdapter`, `sync` and `garden` scheduling |
| `config` | user/project config parsing and precedence | first slice only if pyproject/config needs it |
| `diagnostics` | doctor checks and readiness reports | `doctor`, local install/wiki readiness |
| `updates` | package update planning, installer metadata, supported foreground update methods | `codealmanac update`, `PackageInstallMetadataProvider`, `PackageCommandRunner` |
| `viewer` | read-only browser payloads, page/topic/search/file overview assembly, rendered markdown for the local viewer | `serve`, future non-CLI read adapter |

## Support Packages

| Package | Owns | First implementation pressure |
|---|---|---|
| `prompts` | packaged lifecycle prompt doctrine and operation prompt rendering | `ingest`, `garden`, future `sync` |

## Workflows

| Workflow | Owns | Calls |
|---|---|---|
| `build` | initial wiki creation or refresh | `workspaces`, `wiki`, `index` |
| `ingest` | update wiki from selected local material | `sources`, `runs`, `harnesses`, `index`, `prompts`, `lifecycle` |
| `sync` | discover quiet local transcripts, skip internal lifecycle transcripts, evaluate cursor readiness, run foreground ingest, and update sync cursor ledger | `sources`, `runs`, `ingest`, sync ledger, later `automation` |
| `garden` | maintain wiki shape, links, topics, staleness, quality | `health`, `index`, `runs`, `harnesses`, `prompts`, `lifecycle` |

Workflows coordinate. They do not own durable schema unless a missing service is
identified and added to this map.

`workflows/lifecycle.py` owns shared lifecycle execution helpers: harness-result
validation and Git-backed `.almanac/` mutation safety. Operation-specific
workflows pass their public verb into `LifecycleMutationPolicy`, so shared
safety does not leak another workflow's product language.

## Integration Rule

Concrete adapters live under `integrations/` by the service port they implement:

```text
integrations/
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
```

An integration translates outside-world behavior into service-owned models and
errors. It does not decide product policy.

`src/codealmanac/app.py` is the only production module that wires concrete
integrations. Tests enforce that `cli/`, `workflows/`, and `services/` do not
import `codealmanac.integrations`.

`services/workspaces/ports.py` also owns `WorkspaceChangeProbe`, the port used
by lifecycle workflows to inspect repo/worktree mutation state. The concrete
Git implementation lives in `integrations/workspaces/git/`. Ingest policy
decides what mutations are allowed; the Git integration only reports observed
state.

`integrations/command.py` holds captured subprocess execution shared by local
integration adapters. It is not a service port because it describes local
process mechanics, not a product contract.

`integrations/harnesses/git_status.py` holds Git porcelain changed-file
snapshots shared by Claude and Codex harness adapters.

`services/sources/ports.py` owns `TranscriptDiscoveryAdapter`, the port used by
sync to observe local transcript stores. Concrete Codex and Claude JSONL
scanners live in `integrations/sources/transcripts/`. Those integrations parse
raw provider JSON and return typed `TranscriptCandidate` values; they do not
decide quiet windows, cursor state, or whether ingest should run.

The same source service owns `SourceRuntimeAdapter`, the port used by Ingest to
turn selected source refs into bounded readable material before harness
execution. `integrations/sources/filesystem/` reads explicit local files and
bounded directory material, using Git-backed directory listing inside worktrees,
`pathspec` as the non-Git fallback, and `charset-normalizer` for text decoding.
`integrations/sources/git/` uses Git CLI commands for local
`git:diff` and `git:range` refs. `integrations/sources/github/` uses GitHub CLI
for PR and issue refs. `integrations/sources/transcripts/` reads provider JSONL
transcripts with `jsonlines`, validates known Codex and Claude shapes with
Pydantic, and renders bounded transcript snapshots. Ingest does not branch on
source kind. `integrations/sources/web/` uses `httpx` plus Beautiful Soup to
fetch generic web URLs, remove non-readable HTML nodes, and render bounded
HTML/text snapshots through the same source-runtime port.

`services/automation/ports.py` owns `SchedulerAdapter`, the port used by local
automation install/status/uninstall. The launchd implementation lives in
`integrations/automation/scheduler/` and only translates `ScheduledJob` models
into plist files plus launchctl calls. It does not decide which jobs should
exist or what `sync` and `garden` mean.

`services/updates/ports.py` owns package install metadata and package command
execution ports. `integrations/updates/` reads `importlib.metadata` install
metadata and runs foreground package-manager commands. The service decides
whether an install is safe to update; the integration only reports metadata and
executes the chosen command.

`services/viewer` owns the local browser payload for file references. Its
`file` verb delegates to the index's mentions query and returns matching wiki
pages. It must not read repo source contents directly or reuse source runtime
adapters; selected source material belongs to lifecycle workflows, while viewer
file routes are graph-navigation routes.

## First Slice Boundary

The first Python implementation slice should prove:

- package install metadata exists
- `codealmanac` invokes a Python CLI
- `app.py` wires a minimal application object
- `workspaces` can resolve and initialize a local `.almanac/`
- tests run through public service/CLI entrypoints, not hidden helpers

This is intentionally smaller than the full product surface. It should create
the spine that future slices extend without rework.

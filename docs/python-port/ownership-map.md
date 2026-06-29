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
| `sources` | source observations, source refs, fingerprints, local source state, transcript discovery ports and typed transcript candidates | `SourceAddress`/`SourceRef`/`SourceBrief`, `TranscriptDiscoveryAdapter`, `TranscriptCandidate`, later ingest and sync inputs |
| `runs` | run ledger, events, outputs, lifecycle state, persisted harness transcript identity | `jobs` read surface, lifecycle workflows, future sync exclusion |
| `harnesses` | normalized Codex/Claude run contracts, provider transcript refs, and ports | `HarnessKind`/`RunHarnessRequest`/`HarnessRunResult`/`HarnessTranscriptRef`/`HarnessAdapter`, later `build`, `ingest`, `garden` |
| `automation` | local scheduler decisions, quiet windows, installed task state | `AutomationTask`/`ScheduledJob`/`SchedulerAdapter`, `sync` and `garden` scheduling |
| `config` | user/project config parsing and precedence | first slice only if pyproject/config needs it |
| `diagnostics` | doctor checks and readiness reports | `doctor`, local install/wiki readiness |
| `viewer` | read-only browser payloads, page/topic/search overview assembly, rendered markdown for the local viewer | `serve`, future non-CLI read adapter |

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
  automation/
    scheduler/
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

`integrations/harnesses/command.py` and
`integrations/harnesses/git_status.py` hold shared harness-adapter machinery:
captured subprocess execution and Git porcelain changed-file snapshots. They
are integration helpers, not service ports, because they describe local
provider-process mechanics shared by Claude and Codex adapters.

`services/sources/ports.py` owns `TranscriptDiscoveryAdapter`, the port used by
sync to observe local transcript stores. Concrete Codex and Claude JSONL
scanners live in `integrations/sources/transcripts/`. Those integrations parse
raw provider JSON and return typed `TranscriptCandidate` values; they do not
decide quiet windows, cursor state, or whether ingest should run.

`services/automation/ports.py` owns `SchedulerAdapter`, the port used by local
automation install/status/uninstall. The launchd implementation lives in
`integrations/automation/scheduler/` and only translates `ScheduledJob` models
into plist files plus launchctl calls. It does not decide which jobs should
exist or what `sync` and `garden` mean.

## First Slice Boundary

The first Python implementation slice should prove:

- package install metadata exists
- `codealmanac` invokes a Python CLI
- `app.py` wires a minimal application object
- `workspaces` can resolve and initialize a local `.almanac/`
- tests run through public service/CLI entrypoints, not hidden helpers

This is intentionally smaller than the full product surface. It should create
the spine that future slices extend without rework.

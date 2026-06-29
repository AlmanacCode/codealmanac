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
| `sources` | source observations, source refs, fingerprints, local source state | `SourceAddress`/`SourceRef`/`SourceBrief`, later `ingest` and `sync` inputs |
| `runs` | run ledger, events, outputs, lifecycle state | `jobs` read surface, later lifecycle workflows |
| `harnesses` | normalized Codex/Claude run contracts and ports | later `build`, `ingest`, `garden` |
| `automation` | local scheduler decisions, quiet windows, installed task state | later `sync`/`garden` scheduling |
| `config` | user/project config parsing and precedence | first slice only if pyproject/config needs it |
| `diagnostics` | doctor checks and readiness reports | `doctor`, local install/wiki readiness |
| `viewer` | read-only browser payloads, page/topic/search overview assembly, rendered markdown for the local viewer | `serve`, future non-CLI read adapter |

## Workflows

| Workflow | Owns | Calls |
|---|---|---|
| `build` | initial wiki creation or refresh | `workspaces`, `wiki`, `runs`, `harnesses` |
| `ingest` | update wiki from selected local material | `sources`, `runs`, `harnesses`, `wiki`, `index` |
| `sync` | discover quiet local transcripts and queue ingest work | `automation`, `sources`, `runs`, `ingest` |
| `garden` | maintain wiki shape, links, topics, staleness, quality | `wiki`, `index`, `runs`, `harnesses` |

Workflows coordinate. They do not own durable schema unless a missing service is
identified and added to this map.

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

## First Slice Boundary

The first Python implementation slice should prove:

- package install metadata exists
- `codealmanac` invokes a Python CLI
- `app.py` wires a minimal application object
- `workspaces` can resolve and initialize a local `.almanac/`
- tests run through public service/CLI entrypoints, not hidden helpers

This is intentionally smaller than the full product surface. It should create
the spine that future slices extend without rework.

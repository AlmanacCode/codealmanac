# CodeAlmanac Intentional Architecture Rewrite Contract

Date: 2026-06-27
Branch: `codex/intentional-architecture-rewrite`

## Goal

Rewrite CodeAlmanac into an intentionally designed, high-readability TypeScript codebase. Preserve valuable product behavior, but do not preserve folders, files, abstractions, compatibility paths, or names unless they still earn their place.

The new shape borrows principles from `/Users/kushagrachitkara/Documents/almanac`, especially:

- `docs/python-data-flow-ownership.md`
- `docs/python-core-contract.md`
- `docs/python-port-live-agreement.md`

This is a TypeScript rewrite. The Python implementation is reference material, not a port target.

## Current Problem

The current codebase has real product value, but ownership is not obvious enough from location and names. Several areas are named by historical implementation shape rather than present responsibility:

- `cli/commands/*` contains edge parsing/rendering plus workflow decisions.
- `operations/`, `jobs/`, `harness/`, and `agent/` overlap in provider and lifecycle vocabulary.
- `wiki/indexer/`, `wiki/query/`, `wiki/health/`, `wiki/topics/`, and `wiki/registry/` are useful but not yet presented as one coherent wiki service boundary.
- `sync/` owns transcript discovery and scheduling decisions, while `automation/` and lifecycle commands also expose scheduling behavior.
- Viewer API modules are server/read-model edges but sit beside product services rather than behind an explicit edge boundary.

The rewrite should make the intended architecture visible before reading implementation details.

## Target Dependency Direction

Allowed direction:

```text
cli / viewer / process entrypoints
  -> edges
  -> app composition
  -> services
     -> stores
     -> integrations
```

Rules:

- Edges parse input, call services, and render output. They do not own product decisions.
- App composition wires concrete dependencies. It is the obvious place to see what the product is made of.
- Services own product verbs, workflows, validation, and cross-store coordination.
- Stores own persistence, indexes, file reads/writes, and query mechanics.
- Integrations own external systems, provider SDKs, process execution, launchd, npm, and operating-system boundaries.
- Product decisions must not hide inside stores, integrations, command files, or provider adapters.
- Raw external shapes normalize once at the boundary into typed contracts.

## Target Source Shape

This is the desired north star, not a mechanical one-commit move:

```text
src/
  app/
    compose.ts
    types.ts
  edges/
    cli/
    viewer/
    worker/
  services/
    config/
    diagnostics/
    lifecycle/
    providers/
    review/
    runs/
    setup/
    sync/
    wiki/
  integrations/
    agent-runtimes/
    filesystem/
    os/
    package-manager/
    prompts/
    sqlite/
  shared/
    errors.ts
    ids.ts
    result.ts
    text.ts
```

This shape can change if implementation proves a better ownership map. Any change should keep the same dependency direction and make the call graph easier to explain.

## Service Ownership

| Service | Owns | Must not own |
| --- | --- | --- |
| `wiki` | page files, frontmatter, links, topics, search, health, read models | run lifecycle, provider execution, scheduler timing |
| `runs` | durable run/job records, events, snapshots, terminal transitions, run inspection | provider SDK mechanics, page parsing, CLI rendering |
| `lifecycle` | Build/Absorb/Garden/Ingest/Sync operation verbs and prompt contracts | provider transport, job persistence details, command parsing |
| `providers` | user-facing provider selection/readiness model and runtime capability vocabulary | SDK calls outside integration adapters, setup output |
| `sync` | transcript/source eligibility, cursors, dedupe, quiet-window decisions | scheduled-task installation, provider execution |
| `config` | config schema, normalization, workspace/user settings, provider defaults | readiness probing, CLI tables, operation execution |
| `setup` | first-run product workflow over config, provider readiness, guides, automation | reusable provider execution, global install mechanics |
| `diagnostics` | doctor/status evidence aggregation | repairs, provider execution, lifecycle decisions |
| `review` | review metadata and deterministic review command storage | wiki page prose generation |

## Edge Ownership

CLI files should be thin and shaped by command family:

```text
edges/cli/
  parser/      command flags and Commander wiring
  dispatch/    request construction and service calls
  render/      terminal and JSON output
```

Viewer/server files should be thin and shaped by route/read model:

```text
edges/viewer/
  routes/
  dto/
  static/
```

Internal worker entrypoints are edges too. They may execute one service workflow, but they do not become a second application layer.

## Persistence And Integration Ownership

Stores can live inside service packages when the storage is service-specific. Shared persistence utilities live under `integrations/sqlite/` only when they are true SQLite mechanics.

Provider SDKs, process spawning, app-server protocols, launchd tasks, npm/global install behavior, and filesystem path mechanics belong under `integrations/` or small shared infrastructure. A service can depend on a port/protocol; app composition supplies the concrete integration.

## Code Taste

Readability and aesthetics are correctness requirements.

- Use helper functions when they make callsites easier to read.
- Prefer typed request/result contracts over loose option bags.
- Prefer discriminated unions for mutually exclusive states.
- Prefer standard libraries or mature packages for solved machinery.
- Keep custom parsers or schedulers only when the product owns the syntax or invariant.
- Delete dead compatibility layers once callers have moved.
- Delete names that preserve obsolete mental models.
- Keep files small because ownership is clear, not because of line-count targets.
- If a file gets large, first ask what responsibilities are mixed.

## Behavior To Preserve Unless Deliberately Removed

- CLI aliases: `almanac`, `codealmanac`, and `alm`.
- Query commands: search, show, list, topics, health, reindex.
- Edit/organization commands: tag, review, migrate where still product-valid.
- Lifecycle operations: init/build, absorb, ingest, garden, sync.
- Durable jobs/runs: background and foreground execution, events, logs, snapshots, open/tail/show inspection.
- Provider execution: Codex and Claude paths with provider-specific events and session ids where supported.
- Setup/doctor/update/install surfaces that are still real product behavior.
- Local wiki format and `.almanac/` compatibility unless the rewrite explicitly migrates it.

## Behavior Under Suspicion

These areas need evidence before being preserved:

- Compatibility aliases that exist only for old implementation names.
- Parallel command paths that expose the same product action.
- Provider metadata duplicated across readiness and runtime layers.
- Viewer API read models that duplicate wiki/query logic.
- Hand-rolled process, lock, config, glob, and output parsing machinery.
- Any special case whose only justification is "the code already does this."

## Verification Standard

The rewrite is not done because files moved. It is done only when current evidence shows:

- Main product flows are easy to trace from CLI edge to service to store/integration.
- Tests prove behavior and important dependency rules.
- Real CLI smoke checks pass for common commands.
- Review passes find no major ownership, naming, or accidental-complexity issues.
- A future maintainer can understand the architecture from folder names, file names, and callsites.


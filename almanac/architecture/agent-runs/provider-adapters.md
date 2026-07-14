---
title: Yoke Harness Boundary
topics: [architecture, harnesses, providers, agent-runs]
sources:
  - id: adapter
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/adapter.py
  - id: events
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/events.py
  - id: results
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/results.py
  - id: defaults
    type: file
    path: src/codealmanac/integrations/harnesses/__init__.py
  - id: contract
    type: file
    path: src/codealmanac/services/harnesses/ports.py
  - id: settings
    type: file
    path: src/codealmanac/settings.py
  - id: app
    type: file
    path: src/codealmanac/app.py
  - id: tests
    type: file
    path: tests/test_yoke_harness_integration.py
---

# Yoke Harness Boundary

## What It Owns

CodeAlmanac has one provider integration: `YokeHarnessAdapter`. It implements
the service-owned harness port for Claude and Codex, selects CodeAlmanac's Yoke
surface and run options, and converts Yoke runs and events into durable product
models [@adapter] [@contract].

The adapter explicitly selects Codex app-server and leaves Claude on Yoke's
default Claude surface. It loads the requested build, ingest, or garden agent
from the packaged Yoke collection, forwards the task prompt unchanged, and
applies the trusted non-interactive permission and timeout policy [@adapter].

## Runtime Root

`YokeHarnessAdapter` also requires a `runtime_root: Path` at construction.
`default_harness_adapters(runtime_root)` receives `LocalStatePaths.harness_runtime_dir`
(`state_dir / "harnesses"`, so `~/.codealmanac/harnesses` by default) from the
composition root and passes it to both the Claude and Codex adapters [@defaults]
[@settings] [@app]. The adapter forwards `runtime_root` into `yoke.Harness(...)`
on every `check()` and `run()` call, so Yoke's native provider compilation caches
under CodeAlmanac's own local state instead of writing `.codex` or `.claude`
configuration into the target repository [@adapter].

`check()` cannot run a real repository task, so it uses a sibling working
directory instead of the caller's `cwd`: `runtime_root.parent / "readiness"`
(`~/.codealmanac/readiness` by default), created on demand [@adapter] [@tests].
This keeps readiness probes off whatever directory the CLI happens to be
invoked from.

## What It Does Not Own

The boundary does not implement Claude or Codex protocols, discover provider
events, orchestrate helper agents, rewrite agent instructions, inspect Git
changes, or enforce prompt policy. Those responsibilities belong to Yoke, the
native harness, or the lifecycle prompt. Build, ingest, and garden do not branch
on provider behavior [@adapter] [@defaults].

## Runtime Flow

The workflow chooses a packaged agent identity and constructs typed runtime
context. `YokeHarnessAdapter` binds that agent to the selected provider and
working directory, calls Yoke, projects live events, and returns one terminal
`HarnessRunResult` [@adapter] [@results]. `YokeEventProjector` preserves tool,
usage, session, failure, and native helper lifecycle facts while keeping the
CLI and viewer on CodeAlmanac's stable event vocabulary [@events].

## Key Files

- `adapter.py` owns Yoke construction, readiness, permissions, and run options.
- `events.py` owns Yoke-to-CodeAlmanac event projection.
- `results.py` owns terminal result and failure projection.
- `tests/test_yoke_harness_integration.py` proves agent loading, prompt/model
  forwarding, event serialization, callbacks, failures, and helper correlation
  [@adapter] [@events] [@results] [@tests].

## Failure Modes

Missing tools, authentication failures, timeouts, Pydantic validation errors
from malformed Yoke options, and Yoke errors become unavailable readiness or
failed normalized runs. Unknown future Yoke event kinds remain serializable as
`unknown`; malformed provider JSON does not cross into workflow services
[@adapter] [@events] [@results].

## How To Change It

CodeAlmanac should change this boundary only when its product-owned run
configuration or durable event model changes; new lifecycle capabilities belong
in the appropriate Yoke agent folder as instructions, skills, subagents, or
workflows rather than as Python orchestration in the adapter. See
[Add a harness provider adapter](../../guides/add-a-harness-provider-adapter)
for the ordered steps and boundary tests to add a new runner or Yoke surface.

## Related Pages

See [Harness contract](harness-contract),
[Agents and manuals](../runtime-resources/prompts-and-manuals), and
[Harness event shape](../../reference/harness-event-shape).

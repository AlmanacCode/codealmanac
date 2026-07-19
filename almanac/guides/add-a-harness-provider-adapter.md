---
title: Add A Harness Provider Adapter
topics: [guides, harnesses, yoke]
sources:
  - id: harness-defaults
    type: file
    path: src/codealmanac/integrations/harnesses/__init__.py
    note: Default harness adapter registration for Claude, Codex, and OpenCode.
  - id: yoke-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/adapter.py
    note: Shared Yoke harness adapter for Claude and Codex.
  - id: opencode-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/opencode/adapter.py
    note: Native OpenCode CLI harness adapter.
  - id: kinds
    type: file
    path: src/codealmanac/services/harnesses/kinds.py
  - id: config
    type: file
    path: src/codealmanac/services/config/models.py
  - id: yoke-events
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/events.py
  - id: opencode-events
    type: file
    path: src/codealmanac/integrations/harnesses/opencode/events.py
  - id: yoke-tests
    type: file
    path: tests/test_yoke_harness_integration.py
  - id: opencode-tests
    type: file
    path: tests/test_opencode_harness.py
---

# Add A Harness Provider Adapter

Use this guide when CodeAlmanac needs a new local agent runner (`HarnessKind`)
or a change to how an existing runner is selected. There are **two on-ramps**.
Pick the one that matches the integration surface; do not force every runner
through Yoke.

## Choose An On-Ramp

### 1. Yoke surface (Claude, Codex today)

Use Yoke when the runner is already (or should be) a Yoke provider/surface —
shared auth, sessions, skills, and event vocabulary.

1. Add or extend provider support **in Yoke first** if the surface does not
   exist yet. Prove it against the real provider outside this repo before
   changing CodeAlmanac.
2. In CodeAlmanac, add `HarnessKind`, models (controlled catalog for that
   runner), setup/config choices, and one `YokeHarnessAdapter(kind, …)`
   registration [@kinds] [@config] [@harness-defaults] [@yoke-adapter].
3. Prefer extending `YokeEventProjector` only when CodeAlmanac must persist a
   new durable Yoke fact [@yoke-events].

See [Yoke harness boundary](../architecture/agent-runs/provider-adapters).

### 2. First-class CLI (or SDK) harness (OpenCode today)

Use a dedicated adapter under `integrations/harnesses/<name>/` when the product
should talk to the runner's own CLI/SDK **without** a Yoke pin — for example
OpenCode's `opencode run` path [@opencode-adapter].

1. Implement `HarnessAdapter` (`check` + `run`) returning product
   `HarnessRunResult` / `HarnessEvent` models; project runner-specific streams
   in that package (see OpenCode's event projector) [@opencode-events].
2. Register the adapter in `default_harness_adapters` [@harness-defaults].
3. Wire `HarnessKind`, setup target, config models, telemetry labels, and
   doctor/setup readiness.
4. For model choice: either a controlled catalog (Codex/Claude style) or a
   documented open format validated in config (OpenCode `provider/model` ids —
   see [Controlled model catalog](../decisions/controlled-model-catalog)).
5. Do **not** stage generated agent files into the user's repository. Keep
   harness scratch under product-owned local state (`runtime_root`); OpenCode
   stages agents under `runtime_root/opencode/agents/` and points
   `OPENCODE_CONFIG_DIR` at that additive directory [@opencode-adapter].

See [OpenCode harness](../architecture/agent-runs/opencode-harness).

## Preserve The Product Contract

Services and workflows stay provider-neutral. They call `HarnessesService` with
`RunHarnessRequest` and consume `HarnessRunResult` / `HarnessEvent`. Do not make
workflows parse provider payloads or branch on provider names
[@yoke-events] [@opencode-events].

## Verify The Change

Add focused boundary tests for readiness, prompt/model forwarding, agent
selection, live callbacks, failures, and event serialization
[@yoke-tests] [@opencode-tests]. Then run the real runner surface, the affected
lifecycle operation, the full suite, Ruff, and a fresh install smoke.

Related: [Harness contract](../architecture/agent-runs/harness-contract),
[Agents and manuals](../architecture/runtime-resources/prompts-and-manuals).

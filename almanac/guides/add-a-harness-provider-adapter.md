---
title: Add A Harness Provider Adapter
topics: [guides, harnesses]
sources:
  - id: harness-port
    type: file
    path: src/codealmanac/services/harnesses/ports.py
    note: Service-owned harness adapter protocol.
  - id: harness-service
    type: file
    path: src/codealmanac/services/harnesses/service.py
    note: Harness adapter lookup, readiness, and run behavior.
  - id: harness-kinds
    type: file
    path: src/codealmanac/services/harnesses/kinds.py
    note: Supported harness provider and run status enums.
  - id: harness-results
    type: file
    path: src/codealmanac/services/harnesses/results.py
    note: Harness readiness, transcript, and run result models.
  - id: harness-events
    type: file
    path: src/codealmanac/services/harnesses/events.py
    note: Normalized harness event model.
  - id: harness-request
    type: file
    path: src/codealmanac/services/harnesses/requests.py
    note: Normalized harness run request.
  - id: codex-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/codex/adapter.py
    note: Codex provider adapter example.
  - id: claude-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/claude/adapter.py
    note: Claude provider adapter example.
  - id: harness-defaults
    type: file
    path: src/codealmanac/integrations/harnesses/__init__.py
    note: Default harness adapter registration.
  - id: harness-tests
    type: file
    path: tests/test_harnesses_service.py
    note: Service tests for readiness, adapter selection, and duplicate providers.
---

# Add A Harness Provider Adapter

Use this guide when CodeAlmanac needs to run lifecycle agents through a new provider. A harness provider adapter is the integration edge for an agent runtime. It checks local readiness, runs one normalized task, and returns a normalized `HarnessRunResult` with output, status, optional changed files, transcript metadata, and optional event stream [@harness-port] [@harness-results].

The goal is not to add provider branching to workflows. Build, ingest, and garden call the harness service through the shared [Harness contract](../architecture/agent-runs/harness-contract); provider-specific code lives under `integrations/harnesses/` and is registered at the [provider adapter](../architecture/agent-runs/provider-adapters) boundary. The normalized event shape is described by [Harness event shape](../reference/harness-event-shape).

## Add The Provider Kind

Every adapter has a `kind: HarnessKind` [@harness-port]. If the provider is new, add it to `HarnessKind` and update any public configuration or CLI choices that expose harness selection. `HarnessRunStatus` is provider-neutral and should stay limited to succeeded, failed, and cancelled unless the service contract itself changes [@harness-kinds].

Adding a `HarnessKind` also means adding the new provider to the controlled model catalog. `HarnessConfig.model_matches_harness` looks up `HARNESS_MODELS[self.default]` with no fallback, so a harness kind with no catalog entry raises `KeyError` the first time config validates it as the default. Add entries for the new kind to `HARNESS_MODELS`, `DEFAULT_HARNESS_MODELS`, and the controlled model list before wiring the adapter into setup or config; see [Controlled model catalog](../decisions/controlled-model-catalog) for why the model list is closed rather than open-ended.

Do not encode provider names in workflow logic. `HarnessesService` indexes adapters by `HarnessKind`, rejects duplicate kinds, checks readiness before running, and raises a clear error when the requested kind is missing or unavailable [@harness-service].

## Implement Readiness

Implement `check()` first. It should inspect local availability without starting an agent run [@harness-port]. The Codex adapter runs `codex login status`; the Claude adapter runs `claude auth status` and can fall back to `ANTHROPIC_API_KEY` readiness [@codex-adapter] [@claude-adapter].

Return `HarnessReadiness(available=False, message=..., repair=...)` for missing binaries, timeouts, auth failures, or malformed provider status [@harness-results]. The service includes that message in run failures and, when alternatives exist, suggests switching the default harness [@harness-service].

## Implement Run

`run(request)` receives a `RunHarnessRequest` with the provider kind, model, working directory, prompt, and optional title [@harness-request]. The adapter should translate that request into the provider call, then translate provider output back into CodeAlmanac models.

Follow the existing provider shape. Codex and Claude keep provider execution in the adapter layer: readiness checks happen before the run, provider clients execute the prompt, and provider output is normalized into `HarnessRunResult` and `HarnessEvent` values [@codex-adapter] [@claude-adapter] [@harness-results] [@harness-events].

Populate `changed_files` only when the adapter has a deliberate, tested mechanism for that metadata. Do not add workflow-level parsing or provider-specific branches to recover changed files.

If the provider exposes structured events, map them into `HarnessEvent`. The event model covers text, tool use, tool results, usage, provider sessions, warnings, errors, done events, and helper-agent trace events [@harness-events]. Keep raw provider payloads at the edge as optional `raw` fields; do not make workflows parse provider transcripts.

## Register The Adapter

Add the adapter to `default_harness_adapters()` only when it should be part of normal app construction [@harness-defaults]. Tests can pass a narrow adapter list directly to `HarnessesService` or `create_app`, which keeps provider tests fast and local.

Registration should not add a dispatcher in the service. The service already selects by `HarnessKind` and calls the registered adapter [@harness-service]. If adding the provider requires a switch statement in a workflow, the boundary is in the wrong place.

## Verify The Change

Add service-level tests with a fake adapter before relying on provider integration tests. The existing tests prove that the service runs the registered adapter, refuses unavailable harnesses, reports readiness, handles missing providers, and rejects duplicate adapter kinds [@harness-tests].

Run:

```bash
uv run pytest tests/test_harnesses_service.py
uv run pytest tests/test_architecture.py
uv run ruff check .
```

For provider-specific behavior, add focused tests beside the adapter. Avoid tests that require real credentials unless they are explicitly integration tests.

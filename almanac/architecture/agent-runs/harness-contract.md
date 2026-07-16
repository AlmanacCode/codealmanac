---
title: Harness Contract
topics: [architecture, harnesses, agent-runs]
sources:
  - id: harness-ports
    type: file
    path: src/codealmanac/services/harnesses/ports.py
  - id: harness-requests
    type: file
    path: src/codealmanac/services/harnesses/requests.py
  - id: harness-results
    type: file
    path: src/codealmanac/services/harnesses/results.py
  - id: harness-events
    type: file
    path: src/codealmanac/services/harnesses/events.py
  - id: harness-service
    type: file
    path: src/codealmanac/services/harnesses/service.py
  - id: harness-kinds
    type: file
    path: src/codealmanac/services/harnesses/kinds.py
---

# Harness Contract

The harness contract is the boundary between lifecycle workflows and external agent providers. Build, ingest, and garden send one normalized `RunHarnessRequest` to a selected harness and receive one normalized `HarnessRunResult` back. The workflows do not know whether the provider is Codex or Claude; that provider-specific behavior lives behind the [Yoke harness boundary](provider-adapters) [@harness-ports] [@harness-requests].

The contract matters because lifecycle operations need stable facts after an agent run: readiness, terminal status, output text, optional changed files, transcript references, and normalized events. Those facts feed the [operation runner](../lifecycle/operation-runner), the run ledger, and user-facing job logs without leaking provider JSON streams into the rest of the system [@harness-results] [@harness-events].

## Adapter Shape

A harness adapter has one `kind`, a `check()` method, and a `run()` method [@harness-ports]. `check()` reports local readiness without starting an agent. `run()` executes one agent task and returns a normalized result [@harness-ports].

`HarnessesService` indexes adapters by kind and rejects duplicate adapters [@harness-service]. Workflows call `ensure_ready` and `run_ready` as separate stages: readiness failures can include a repair hint and a command to switch harnesses, while every exception from the approved adapter invocation is a provider-execution failure. `run_ready` also wraps caller event-sink failures in `HarnessEventSinkFailed`, keeping local run-log persistence failures distinct from provider failures that occur during the same call [@harness-service].

The supported harness kinds are currently `codex` and `claude`. The terminal run statuses are `succeeded`, `failed`, and `cancelled` [@harness-kinds].

## Run Requests

`RunHarnessRequest` is small on purpose. It carries the harness kind, model, agent kind, working directory, prompt, and optional title [@harness-requests]. The agent kind is one of `build`, `ingest`, or `garden`; it tells the adapter which packaged Yoke agent to load for the run, so one adapter can serve every lifecycle operation instead of branching per operation [@harness-requests]. The prompt is already rendered by the lifecycle workflow before it crosses this boundary. That keeps prompt composition in runtime resources and operation workflows, while adapters focus on provider execution.

The request requires non-empty `model` and `prompt` text; the harness contract does not re-validate model names against a catalog [@harness-requests]. The controlled model set that constrains which names ever reach this request is enforced earlier, in config; see [Controlled model catalog](../../decisions/controlled-model-catalog) for the allowed models and why the set is closed. A harness adapter may translate the request into provider options, CLI arguments, SDK calls, or app-server messages, but it must return to the same result model.

## Results

`HarnessRunResult` records the provider kind, terminal status, output text, optional summary, changed files, optional transcript reference, and normalized event stream [@harness-results]. The changed-file list is metadata on the result model; provider adapters should only populate it when they have a tested mechanism for doing so.

Transcript references are represented by `HarnessTranscriptRef`, which stores the harness kind, provider session id, and optional transcript path [@harness-results]. This lets job views and later transcript sync connect an operation run to provider history without making every workflow parse provider storage directly.

## Events

Harness events form the provider-neutral event vocabulary for job logs and attach streams. Event kinds include text deltas, text blocks, tool use and result events, context usage, provider session announcements, warnings, errors, done events, and helper-agent lifecycle events [@harness-events]. The exact fields are defined in [harness event shape](../../reference/harness-event-shape).

Events also carry structured details when available: tool display data, token usage, provider ids, actor information, failure classification, and agent trace metadata [@harness-events]. This allows a Codex app-server notification or a Claude SDK message to become the same kind of log event before it reaches the rest of the product.

## Boundary Rule

The harness contract is a normalization boundary. The [Yoke harness boundary](provider-adapters) may deal with agent selection, provider run options, sandbox and permission policy, and Yoke-specific failures. Service and workflow code should only depend on `HarnessReadiness`, `RunHarnessRequest`, `HarnessRunResult`, and `HarnessEvent` [@harness-service] [@harness-results].

That rule keeps the boundary additive: mapping provider events into the normalized event shape and populating result metadata stays inside the adapter, so the lifecycle workflows never gain provider branches.

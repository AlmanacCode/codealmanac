---
title: Extend The Yoke Harness Boundary
topics: [guides, harnesses, providers]
sources:
  - id: adapter
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/adapter.py
  - id: defaults
    type: file
    path: src/codealmanac/integrations/harnesses/__init__.py
  - id: kinds
    type: file
    path: src/codealmanac/services/harnesses/kinds.py
  - id: config
    type: file
    path: src/codealmanac/services/config/models.py
  - id: events
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/events.py
  - id: tests
    type: file
    path: tests/test_yoke_harness_integration.py
  - id: model-catalog
    type: wiki
    path: decisions/controlled-model-catalog
    note: Decision that keeps supported harness models in a controlled catalog.
  - id: config-keys
    type: wiki
    path: reference/config-keys
    note: Reference page for supported config keys and model validation.
  - id: opencode-pr-review
    type: conversation
    session_id: rollout-2026-07-12T11-29-59-019f5797-e03a-7971-ab11-939e3cf4b1be
---

# Extend The Yoke Harness Boundary

Use this guide when CodeAlmanac needs a new provider, surface, or portable Yoke
capability. CodeAlmanac does not implement another provider protocol adapter.
Add or correct that support in Yoke, release it, and then keep the product
boundary thin [@adapter].

## Add Provider Support To Yoke

Yoke owns authentication, provider processes, native surface options, skills,
subagents, sessions, models, and normalized provider events. Prove the feature
against the real provider in Yoke before changing CodeAlmanac. Do not reproduce
SDK or JSON-RPC behavior under `integrations/harnesses/`.

## Add The Product Choice

If this is a genuinely new CodeAlmanac runner, add its `HarnessKind`, controlled
models, defaults, setup/config choices, and one `YokeHarnessAdapter` registration
[@kinds] [@config] [@defaults]. [Controlled model catalog](../decisions/controlled-model-catalog)
owns the rule that supported models are a CodeAlmanac product list, and
[Config keys](../reference/config-keys) owns the user-facing config contract for
`harness.default` and `harness.model` [@model-catalog] [@config-keys]. If it is
only a different Yoke surface for an existing runner, change the explicit
surface selection in the Yoke adapter and document why the product requires it
[@adapter].

## Preserve The Product Contract

The service-owned request, result, and event models stay provider-neutral.
Extend `YokeEventProjector` only when CodeAlmanac needs to persist or present a
new durable Yoke fact. Do not make workflows parse provider payloads or branch
on provider names [@events].

## Verify The Change

Add focused boundary tests for readiness, exact task forwarding, model and
agent selection, callbacks, failures, event serialization, and any new display
facts [@tests]. Then run the real provider surface, the affected lifecycle
operation, the full test suite, Ruff, wheel/sdist builds, Twine checks, and a
fresh installed-wheel smoke.

When the Yoke change adds a new surface such as OpenCode, review the upstream
Yoke PR for the contracts CodeAlmanac cannot repair locally: requested
permissions must either be enforced or rejected, runtime deployment files must
stay alive for active forks, first-send instructions must survive provider
retry paths, and CodeAlmanac must depend on a released Yoke version rather than
a local sibling checkout [@opencode-pr-review].

Related architecture: [Yoke provider adapter boundary](../architecture/agent-runs/provider-adapters)
and [Runtime resources](../architecture/runtime-resources/prompts-and-manuals).

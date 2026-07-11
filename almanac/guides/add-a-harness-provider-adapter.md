---
title: Extend The Yoke Harness Boundary
topics: [guides, harnesses, yoke]
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
[@kinds] [@config] [@defaults]. If it is only a different Yoke surface for an
existing runner, change the explicit surface selection in the Yoke adapter and
document why the product requires it [@adapter].

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

Related architecture: [Yoke harness boundary](../architecture/agent-runs/provider-adapters)
and [Agents and manuals](../architecture/runtime-resources/prompts-and-manuals).

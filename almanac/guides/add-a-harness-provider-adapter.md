---
title: Add A Harness Provider Adapter
topics: [guides, harnesses, providers, yoke]
sources:
  - id: pyproject
    type: file
    path: pyproject.toml
    note: Yoke package dependency used by the harness adapter.
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

# Add A Harness Provider Adapter

Use this guide when CodeAlmanac needs to add a new local agent runner (a new
`HarnessKind`, such as a future harness alongside Codex and Claude) or change
which Yoke surface an existing runner uses. The guide has two parts because the
work usually spans two repos: provider or surface support belongs in Yoke, and
the CodeAlmanac-side product choice — the `HarnessKind`, controlled models, and
`YokeHarnessAdapter` registration — belongs here.

## Add Provider Support To Yoke First

If the provider or surface CodeAlmanac needs does not exist yet, add it in Yoke,
not in this repo. CodeAlmanac does not implement its own provider protocol
adapter [@adapter]. Yoke owns authentication, provider processes, native surface
options, skills, subagents, sessions, models, and normalized provider events.
Prove the feature against the real provider in Yoke before changing CodeAlmanac,
then require a released Yoke version that contains that provider in
`pyproject.toml` [@pyproject]. Do not reproduce SDK or JSON-RPC behavior under
`integrations/harnesses/`.

## Add The Product Choice In CodeAlmanac

Once Yoke supports the provider or surface, wire the product-side choice:

- For a genuinely new CodeAlmanac runner, add its `HarnessKind`, controlled
  models, defaults, setup/config choices, and one `YokeHarnessAdapter`
  registration [@kinds] [@config] [@defaults].
- For a different Yoke surface on an existing runner (for example, switching
  which Codex surface is selected), change the explicit surface selection in
  the Yoke adapter and document why the product requires it [@adapter].

See [Yoke harness boundary](../architecture/agent-runs/provider-adapters) for
what the adapter currently owns before changing it.

## Preserve The Product Contract

The service-owned request, result, and event models stay provider-neutral.
Extend `YokeEventProjector` only when CodeAlmanac needs to persist or present a
new durable Yoke fact. Do not make workflows parse provider payloads or branch
on provider names [@events].

## Verify The Change

Add focused boundary tests for readiness, exact task forwarding, model and
agent selection, callbacks, failures, event serialization, and any new display
facts [@tests]. Once a provider is added to `HarnessKind`, tests must assert that
`create_yoke_harness(...)` starts for that provider with the pinned Yoke release
instead of skipping when Yoke lacks the enum or surface [@kinds] [@adapter]
[@pyproject] [@tests]. Then run the real provider surface, the affected
lifecycle operation, the full test suite, Ruff, wheel/sdist builds, Twine
checks, and a fresh installed-wheel smoke.

Related architecture: [Yoke harness boundary](../architecture/agent-runs/provider-adapters)
and [Agents and manuals](../architecture/runtime-resources/prompts-and-manuals).

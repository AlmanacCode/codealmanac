---
title: Controlled Model Catalog
topics: [decisions, config, harnesses]
sources:
  - id: config-models
    type: file
    path: src/codealmanac/services/config/models.py
    note: Controlled harness model list, OpenCode format validation, defaults, config keys.
  - id: opencode-models
    type: file
    path: src/codealmanac/services/config/opencode_models.py
    note: OpenCode provider/model id shape checks and fallback list constants.
  - id: config-service
    type: file
    path: src/codealmanac/services/config/service.py
    note: Config service behavior for listing, reading, and setting runner/model values.
  - id: config-tests
    type: file
    path: tests/test_controlled_model_config.py
    note: Tests for unknown model rejection, provider/model matching, and default reset behavior.
  - id: config-plan
    type: file
    path: docs/plans/2026-07-07-controlled-model-config.md
    note: Original implementation plan for the closed Codex/Claude catalog.
---

# Controlled Model Catalog

CodeAlmanac owns model choice for lifecycle harnesses. The selected runner and
model live in config as `harness.default` and `harness.model` [@config-models].
Codex and Claude use a **closed product catalog**. OpenCode uses a **format
rule** over OpenCode's own `provider/model` ids so auth and live menus stay with
OpenCode while CodeAlmanac still validates shape [@opencode-models].

## Status

Accepted, with an OpenCode carve-out documented below. Codex/Claude catalog:
`src/codealmanac/services/config/models.py`. OpenCode ids:
`src/codealmanac/services/config/opencode_models.py` [@config-models]
[@opencode-models] [@config-tests].

## Context

CodeAlmanac runs lifecycle jobs through more than one local harness. That creates
two different choices: where agent instructions are installed, and which
runner/model pair performs CodeAlmanac jobs [@config-plan].

For Codex and Claude, provider CLI discovery is an unstable product surface —
experimental, renamed, or account-specific models leak into setup. The plan
rejects treating `codex debug models` or Claude discovery as product truth
[@config-plan].

OpenCode is different: it is a **router** over many providers (OpenRouter,
provider-native APIs, Zen free models, and so on). A closed CodeAlmanac list
cannot keep pace or know what the user authenticated. OpenCode's CLI already
owns that catalog via `opencode models` and provider login.

## Decision

### Codex and Claude

- Allowed names live in `CONTROLLED_HARNESS_MODELS` and per-harness
  `HARNESS_MODELS` with defaults in `DEFAULT_HARNESS_MODELS` [@config-models].
- `HarnessConfig` requires the model to be in the catalog **and** belong to
  the selected harness [@config-models] [@config-tests].
- Adding a model is an explicit code change plus tests, not a discovery side
  effect [@config-models] [@config-tests].

### OpenCode

- Any non-empty `provider/model` id (model segment may contain further `/`, for
  example `openrouter/z-ai/glm-5`) is accepted when `harness.default` is
  `opencode` [@opencode-models] [@config-models].
- Setup's model menu prefers the live list from `opencode models` and falls back
  to a short curated list only when the CLI is missing [@config-models].
- `config set harness.model` may still set any well-formed OpenCode id, even if
  it is not currently in that menu — availability at run time is OpenCode's
  responsibility (auth and provider config).
- Switching `harness.default` still resets `harness.model` to that harness's
  default so the stored pair stays coherent [@config-service] [@config-tests].

Config keys and tables: [Config keys](../reference/config-keys).

## Consequences

Codex/Claude stay small, reviewable, and intentionally laggy as a product
catalog [@config-plan]. OpenCode users can point CodeAlmanac at OpenRouter or
any model their OpenCode install is connected to without waiting for a
CodeAlmanac release. Workflows still receive an explicit model string on
`RunHarnessRequest`; they do not discover models themselves.

Related: [Yoke harness boundary](../architecture/agent-runs/provider-adapters),
[OpenCode harness](../architecture/agent-runs/opencode-harness).

---
title: Controlled Model Catalog
topics: [decisions]
sources:
  - id: config-models
    type: file
    path: src/codealmanac/services/config/models.py
    note: Controlled harness model list, defaults, config keys, and validation.
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
    note: Implementation plan that records the product decision and intended setup/config behavior.
---

# Controlled Model Catalog

CodeAlmanac owns a controlled catalog of AI runner models. It does not discover arbitrary provider models during setup, accept provider defaults as product truth, or let harness adapters decide which models are supported [@config-plan]. The selected runner and model are stored in config as `harness.default` and `harness.model`, then passed toward lifecycle work as explicit settings [@config-models].

The decision keeps model choice small, reviewable, and stable. Provider adapters can execute a chosen model, but the product list belongs to config and setup. This constrains future work in [Provider adapters](../architecture/agent-runs/provider-adapters), [Automation and update](../architecture/setup/automation-and-update), and [Config keys](../reference/config-keys).

## Status

Accepted. The controlled catalog is implemented in `src/codealmanac/services/config/models.py` and enforced by config tests [@config-models] [@config-tests].

## Context

CodeAlmanac can run lifecycle jobs through more than one local harness. That creates two different choices: where agent instructions are installed, and which runner/model pair performs CodeAlmanac jobs [@config-plan]. Combining those choices would make setup confusing, because a user might install instructions for both Codex and Claude while choosing only one default runner.

Provider discovery also creates an unstable product surface. A local provider command could expose experimental, unavailable, renamed, or account-specific models. The plan explicitly rejects `codex debug models`, Claude discovery, provider defaults, and custom model entry during onboarding [@config-plan].

## Decision

The config model defines the allowed model names in `CONTROLLED_HARNESS_MODELS`. It also groups them by harness in `HARNESS_MODELS` and defines recommended defaults in `DEFAULT_HARNESS_MODELS` [@config-models].

`HarnessConfig` validates two things. First, `harness.model` must be in the controlled catalog. Second, the model must belong to the selected harness, so a Claude default cannot use a Codex model and a Codex default cannot use a Claude model [@config-models]. The tests cover both rejection paths [@config-tests].

The config service exposes `auto_commit`, `harness.default`, and `harness.model` through `config list`, `config get`, and `config set` [@config-service]. Changing `harness.default` resets `harness.model` to that harness's recommended default, which keeps the stored pair valid after a runner switch [@config-service] [@config-tests].

## Consequences

Adding a new model is a code change, not a provider-discovery side effect. A maintainer updates the catalog, the harness grouping, and the tests in one place [@config-models] [@config-tests].

Setup and automation can depend on a known runner/model pair. `SetupService` writes both `harness.default` and `harness.model`, so unattended lifecycle work does not need to ask a provider what it should run [@config-service].

The cost is that users cannot type an arbitrary provider model into CodeAlmanac config. That is intentional. A model becomes supported when the project accepts it into the controlled catalog.

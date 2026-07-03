---
page_id: reference-config-and-state
title: Config And State Paths
summary: This page lists the user and project configuration paths used by the Python implementation.
topics: [reference, storage]
sources:
  - id: core-models
    type: file
    path: src/codealmanac/core/models.py
  - id: config-service
    type: file
    path: src/codealmanac/services/config/service.py
  - id: public-contract
    type: file
    path: tests/test_public_contract.py
---

# Config And State Paths

CodeAlmanac stores global user state under `~/.codealmanac/` and can read project configuration from the selected Almanac root. Public-contract tests require the default registry and config paths to use the product-specific hidden directory. [@core-models] [@config-service] [@public-contract]

## Paths

| Path | Meaning |
|---|---|
| `~/.codealmanac/registry.json` | Global workspace registry. |
| `~/.codealmanac/config.toml` | User config. |
| `<almanac-root>/config.toml` | Project config for a selected wiki. |

`ConfigService` loads project config first when a workspace is resolved, then user config. [@config-service]

## Related pages

Read `[[concept-workspace]]` and `[[architecture-workspaces-and-roots]]`.


---
title: Config Keys
topics: [reference, config, setup, harnesses, telemetry]
sources:
  - id: readme
    type: file
    path: README.md
    note: Public configuration paths, examples, and CLI precedence statement.
  - id: config-models
    type: file
    path: src/codealmanac/services/config/models.py
    note: Supported config keys, defaults, controlled model catalog, and validation.
  - id: config-service
    type: file
    path: src/codealmanac/services/config/service.py
    note: User config reads, writes, and automation reconciliation.
  - id: config-store
    type: file
    path: src/codealmanac/services/config/store.py
    note: TOML loading, validation, and batch write behavior.
  - id: config-dispatch
    type: file
    path: src/codealmanac/cli/dispatch/config.py
    note: CLI config loading and harness flag resolution.
  - id: config-parser
    type: file
    path: src/codealmanac/cli/parser/config.py
    note: Public config command keys.
  - id: config-tests
    type: file
    path: tests/test_config_service.py
    note: Tests for defaults, user-only behavior, reconciliation, and invalid values.
  - id: telemetry-architecture
    type: wiki
    path: architecture/telemetry
    note: Architecture page for telemetry policy, identity, event, and delivery boundaries.
---

# Config Keys

Config keys are the user-level TOML surface for lifecycle and machine-automation preferences. CodeAlmanac reads one file at `~/.codealmanac/config.toml`; repository-level config is not supported [@readme] [@config-service]. CLI flags still override config for one command.

This page defines the current keys, defaults, validation, and precedence. Machine-level setup is described in [Automation and update](../architecture/setup/automation-and-update), and the model allowlist decision is described in [Controlled model catalog](../decisions/controlled-model-catalog).

## Files And Precedence

| Layer | Path or source | Notes |
| --- | --- | --- |
| CLI flags | Command-specific flags such as `--using` | Highest precedence for that command [@readme] [@config-dispatch]. |
| User config | `~/.codealmanac/config.toml` | Global user defaults [@readme] [@config-service]. |
| Built-in defaults | Pydantic defaults | Used when no config file sets the value [@config-models]. |

`ConfigService.load_user` validates the one user file through `UserConfig`. `config list` and `config get` inspect desired values. `config set` writes one value and immediately reconciles its automation task when the key is under `automation.*`. `config apply` validates direct TOML edits and reconciles all three tasks [@config-service] [@config-parser].

Service tests cover built-in defaults, rejection of repository config, immediate
single-task reconciliation, explicit apply, and invalid values that must not be
written [@config-tests].

## Supported Keys

| Key | Type | Default | Valid values |
| --- | --- | --- | --- |
| `auto_commit` | Boolean | `true` | `true` or `false` |
| `harness.default` | Harness name | `codex` | `codex` or `claude` |
| `harness.model` | Model name | `gpt-5.5` | One model from the selected harness catalog |
| `telemetry.enabled` | Boolean | `true` | `true` or `false` |
| `automation.sync.enabled` | Boolean | `true` | `true` or `false` |
| `automation.sync.every` | Duration | `5h` | Positive human duration |
| `automation.garden.enabled` | Boolean | `true` | `true` or `false` |
| `automation.garden.every` | Duration | `24h` | Positive human duration |
| `automation.update.enabled` | Boolean | `true` | `true` or `false` |
| `automation.update.every` | Duration | `24h` | Positive human duration |

`auto_commit` is prompt policy. It means lifecycle prompts may tell the selected agent to use normal Git commands for wiki source changes; CodeAlmanac itself does not stage, split, or commit diffs [@readme].

`harness.default` chooses the default lifecycle harness. Setting it also resets `harness.model` to that harness's default model, so switching from Codex to Claude leaves the config valid [@config-service].

`harness.model` must be in the global controlled model set and must also belong to the currently selected default harness [@config-models] [@config-service].

`telemetry.enabled` controls anonymous command, lifecycle, and sanitized crash
telemetry. Setting it to `false` takes effect on the next event. The installation
UUID remains local SQLite state rather than TOML configuration
[@telemetry-architecture].

## Harness Models

| Harness | Allowed models | Harness default |
| --- | --- | --- |
| `codex` | `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex-spark` | `gpt-5.5` |
| `claude` | `claude-sonnet-5`, `claude-opus-4-7`, `claude-haiku-4-5` | `claude-sonnet-5` |

The model validator rejects unknown model names and rejects known model names that do not match the selected harness [@config-models]. The service-level parser raises the same product errors when a user runs `config set harness.model ...` [@config-service].

## TOML Shape

A complete config file can look like this:

```toml
auto_commit = true

[harness]
default = "codex"
model = "gpt-5.5"

[telemetry]
enabled = true

[automation.sync]
enabled = true
every = "5h"

[automation.garden]
enabled = true
every = "24h"

[automation.update]
enabled = true
every = "24h"
```

`ConfigStore` rejects invalid TOML and invalid typed values, including non-positive automation intervals. Batch setup updates perform one TOML write. `ConfigService` then asks `AutomationService` to install enabled tasks and remove disabled tasks [@config-store] [@config-service].

Direct edits do not reload launchd by themselves. Run `codealmanac config apply` after editing the file. `codealmanac automation status` reports actual scheduler state [@readme].

## CLI Resolution

Lifecycle dispatch loads user config and resolves a harness flag over it. If the command does not pass a harness value, `resolve_harness` returns `config.harness.default`; if a command selects a different harness, `resolve_harness_model` uses that harness's default model instead of the configured model for another harness [@config-dispatch].

Scheduled automation and local setup use these same defaults when launching unattended work. See [Setup local automation](../guides/setup-local-automation) for the operational path.

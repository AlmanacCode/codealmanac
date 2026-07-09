---
title: Config Keys
topics: [reference, config, setup, harnesses]
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
    note: Config load precedence, set behavior, and project config path.
  - id: config-store
    type: file
    path: src/codealmanac/services/config/store.py
    note: TOML loading, deep merge, and write behavior.
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
    note: Tests for defaults, precedence, set behavior, and invalid values.
---

# Config Keys

Config keys are the small TOML surface that controls default lifecycle execution. CodeAlmanac currently supports `auto_commit`, `harness.default`, and `harness.model` [@config-models]. User config lives at `~/.codealmanac/config.toml`, project config may live at `almanac/config.toml`, and CLI flags still take precedence over config [@readme].

This page defines the current keys, defaults, validation, and precedence. Machine-level setup is described in [Automation and update](../architecture/setup/automation-and-update), and the model allowlist decision is described in [Controlled model catalog](../decisions/controlled-model-catalog).

## Files And Precedence

| Layer | Path or source | Notes |
| --- | --- | --- |
| CLI flags | Command-specific flags such as `--using` | Highest precedence for that command [@readme] [@config-dispatch]. |
| Project config | `almanac/config.toml` | Loaded when a repository can be selected [@config-service]. |
| User config | `~/.codealmanac/config.toml` | Global user defaults [@readme] [@config-service]. |
| Built-in defaults | Pydantic defaults | Used when no config file sets the value [@config-models]. |

`ConfigService.load` looks for project config through repository selection, then passes project and user paths to the config store [@config-service]. The store loads TOML sources with deep merge behavior, so project values can override user values while leaving unspecified user values in place [@config-store] [@config-tests].

`codealmanac config set` writes only the user config path. It does not edit `almanac/config.toml` [@config-service]. `config list`, `config get`, and `config set` expose only the three supported keys [@config-parser] [@config-service].

## Supported Keys

| Key | Type | Default | Valid values |
| --- | --- | --- | --- |
| `auto_commit` | Boolean | `true` | `true` or `false` |
| `harness.default` | Harness name | `codex` | `codex` or `claude` |
| `harness.model` | Model name | `gpt-5.5` | One model from the selected harness catalog |

`auto_commit` is prompt policy. It means lifecycle prompts may tell the selected agent to use normal Git commands for wiki source changes; CodeAlmanac itself does not stage, split, or commit diffs [@readme].

`harness.default` chooses the default lifecycle harness. Setting it also resets `harness.model` to that harness's default model, so switching from Codex to Claude leaves the config valid [@config-service].

`harness.model` must be in the global controlled model set and must also belong to the currently selected default harness [@config-models] [@config-service].

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
```

`ConfigStore` rejects invalid TOML and invalid model values as validation failures [@config-store]. When it writes a key, it preserves existing valid TOML structure where possible, creates missing parent directories, and validates the resulting file by reloading it [@config-store] [@config-service].

## CLI Resolution

Lifecycle dispatch loads config for the selected wiki and resolves a harness flag over that config. If the command does not pass a harness value, `resolve_harness` returns `config.harness.default`; if a command selects a different harness, `resolve_harness_model` uses that harness's default model instead of the configured model for another harness [@config-dispatch].

Scheduled automation and local setup use these same defaults when launching unattended work. See [Setup local automation](../guides/setup-local-automation) for the operational path.

# Controlled Model Config Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a controlled AI-runner model setting for CodeAlmanac setup and later config changes.

**Architecture:** The source of truth is a curated CodeAlmanac model catalog, not provider discovery. Config owns the selected runner and model; CLI commands only parse user input and render service results. Provider adapters may receive the chosen model later, but they must not decide the product model list.

**Tech Stack:** Python, Pydantic settings models, TOML config, argparse, pytest, ruff.

---

## Product Decision

CodeAlmanac controls the model list. Do not use `codex debug models`, Claude model discovery, provider defaults, or custom model entry during onboarding.

Setup should ask two separate questions:

- Agent instructions: where CodeAlmanac installs instructions, such as Codex, Claude, or both.
- AI runner: which agent and controlled model CodeAlmanac jobs use for build, ingest, sync, and garden.

The selected model is stored as:

```toml
[harness]
default = "codex"
model = "gpt-5.5"
```

Users change it later with:

```bash
codealmanac config list
codealmanac config get harness.default
codealmanac config get harness.model
codealmanac config set harness.default claude
codealmanac config set harness.model claude-sonnet-4-6
```

## Controlled Catalog

Initial allowed models:

```text
gpt-5.5
gpt-5.4
gpt-5.4-mini
gpt-5.3-codex-spark
claude-opus-4-7
claude-sonnet-4-6
claude-haiku-4-5
```

Recommended defaults:

```text
codex  -> gpt-5.5
claude -> claude-sonnet-4-6
```

## Task 1: Config Model

**Files:**
- Modify: `src/codealmanac/services/config/models.py`
- Modify: `src/codealmanac/services/config/service.py`

Steps:

1. Add `harness.model` to `HarnessConfig`.
2. Add `ConfigKey.HARNESS_MODEL`.
3. Validate model values against the controlled catalog.
4. Keep `harness.default` validation provider-only.

## Task 2: Config Commands

**Files:**
- Modify: `src/codealmanac/cli/parser/config.py`
- Modify: `src/codealmanac/cli/dispatch/config_command.py`
- Modify: `src/codealmanac/cli/render/config.py`

Steps:

1. Add `config list`.
2. Add `config get <key>`.
3. Keep `config set <key> <value>`.
4. Render simple rows for humans and shaped JSON for scripts.

## Task 3: Setup Flow

**Files:**
- Modify: `src/codealmanac/cli/dispatch/setup_tui.py`
- Modify: `src/codealmanac/cli/dispatch/setup_wizard/models.py`
- Modify: `src/codealmanac/cli/dispatch/setup_wizard/options.py`
- Modify: `src/codealmanac/cli/render/setup/screens.py`
- Modify: `src/codealmanac/cli/render/setup/result.py`
- Modify: `src/codealmanac/services/setup/requests.py`
- Modify: `src/codealmanac/services/setup/service.py`

Steps:

1. Keep agent instruction selection separate from AI runner selection.
2. Ask the runner model as a vertical list, not horizontal cards.
3. Store both `harness.default` and `harness.model` during setup.
4. Show the chosen model in setup completion output.

## Task 4: Run Model Plumbing

**Files:**
- Modify: `src/codealmanac/workflows/*/requests.py`
- Modify: `src/codealmanac/workflows/*/service.py`
- Modify: `src/codealmanac/workflows/run_queue/*`
- Modify: `src/codealmanac/integrations/harnesses/*`

Steps:

1. Resolve the configured model at the CLI edge.
2. Carry the model through build, ingest, garden, sync-created ingest, queue specs, and queue worker replay.
3. Pass the model into Codex and Claude harness adapters.
4. If `--using` chooses a non-default runner for one command, use that runner's recommended model.

## Task 5: Verify

Run:

```bash
uv run python -m compileall -q src/codealmanac tests/test_controlled_model_config.py
uv run ruff check src/codealmanac tests/test_controlled_model_config.py
uv run pytest tests/test_controlled_model_config.py
uv run codealmanac config list
uv run codealmanac config get harness.model
```

Full `uv run pytest` is not the gate for this branch until the stale test imports
from the broader refactor are repaired. It currently fails during collection on
retired names such as `InitializeRepositoryRequest` and `RepositoryStatus`.

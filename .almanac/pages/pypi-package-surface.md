---
title: PyPI Package Surface
summary: The published `codealmanac` Python package exposes the public CLI plus private local-control entrypoints, and release smoke must prove stale launch-era commands stay absent.
topics:
  - cli
  - systems
sources:
  - id: pyproject
    type: file
    path: pyproject.toml
    note: Defines the `codealmanac` PyPI package version, Python requirement, package data, and console script entrypoints.
  - id: local-trigger
    type: file
    path: src/codealmanac/local_trigger.py
    note: Implements the private local Git-hook trigger entrypoint shipped as `codealmanac-local-trigger`.
  - id: local-worker
    type: file
    path: src/codealmanac/local_worker.py
    note: Implements the private local worker entrypoint shipped as `codealmanac-local-worker`.
  - id: local-parser
    type: file
    path: src/codealmanac/cli/parser/local.py
    note: Defines current local setup, triggers, delivery, and runs subcommands.
  - id: release-verification
    type: file
    path: docs/codealmanac-launch/verification-matrix.md
    note: Records Slice 89 and Slice 90 evidence for the CLI run-surface cleanup, wheel smoke, GitHub Actions publish, and public PyPI install smoke.
status: active
verified: 2026-07-04
---

# PyPI Package Surface

The current public package is the Python `codealmanac` distribution on PyPI. It installs the public `codealmanac` CLI and two private local-control console scripts: `codealmanac-local-trigger` and `codealmanac-local-worker`. Those private scripts are package surface because Git hooks and detached local workers need stable executable names, but they are not root CLI subcommands a user should discover as product commands. [@pyproject] [@local-trigger] [@local-worker]

## Current Package Contract

`pyproject.toml` defines package version `0.1.10`, requires Python 3.12 or newer, and exposes exactly these console scripts: `codealmanac`, `codealmanac-local-trigger`, and `codealmanac-local-worker`. The same package ships manual and prompt Markdown as package data, so release checks must cover both executable entrypoints and bundled resources when those surfaces change. [@pyproject]

The launch-facing CLI must not expose the old scheduled `sync` and root `automation` model, and local branch execution must not use the stale `local update` or `local jobs` spellings. Current local execution is under `codealmanac local runs start`, with `local runs list`, `show`, and `logs` for local control-database history. [@local-parser] [@release-verification]

## Release Evidence

Slice 90 published `codealmanac` `0.1.10` from `main` through GitHub Actions run `28690993407`. The release matrix records passing tests, lint, diff hygiene, build checks, artifact checks, artifact upload, PyPI upload, and a fresh public temp-home install with `uv tool install --python 3.12 --refresh --no-cache --force codealmanac==0.1.10`. [@release-verification]

That public smoke is the release bar for the Slice 89 CLI cleanup: the installed package returned version `0.1.10`, exposed `codealmanac`, `codealmanac-local-trigger`, and `codealmanac-local-worker`, and kept stale `sync`, root scheduled `automation`, `local update`, and `local jobs` help text out of the launch-facing CLI. [@release-verification]

## Verification Rule

Future release work that touches CLI naming, local branch runs, setup, uninstall, packaged resources, or console scripts should verify the installed artifact, not only the source checkout. A wheel or PyPI smoke should check `codealmanac --version`, root help, `codealmanac local --help`, and the private local trigger/worker help paths. [@release-verification]

---
title: Release Package
topics: [guides, product]
sources:
  - id: release-doc
    type: file
    path: RELEASE.md
    note: Python package release checklist and package-surface rules.
  - id: pyproject
    type: file
    path: pyproject.toml
    note: Package name, version, Python requirement, dependencies, script entrypoints, and package data.
  - id: readme
    type: file
    path: README.md
    note: Public install commands and local-only product description.
  - id: public-contract-tests
    type: file
    path: tests/test_public_contract.py
    note: Tests that guard README, release, GitHub, command, and package surface promises.
  - id: run-parser
    type: file
    path: src/codealmanac/cli/parser/run_commands.py
    note: Current public sync command syntax.
  - id: server-assets
    type: file
    path: src/codealmanac/server/assets/
    note: Viewer assets included in the published package.
---

# Release Package

Use this guide when publishing the `codealmanac` Python package to PyPI. A release publishes the local CLI package and its packaged resources; it does not publish a hosted service, npm package, SDK, MCP package, or undeclared legacy command alias, matching the [Local-only Python product](../decisions/local-only-python-product) decision [@release-doc] [@public-contract-tests]. The release is not done when PyPI accepts files. It is done when clean installed artifacts and the public install path can run the `codealmanac` command outside the repo developer environment [@release-doc] [@readme].

## Preconditions

Start from a clean checkout of the release branch. `pyproject.toml` owns the package version, requires Python 3.12 or newer, and maps both the canonical `codealmanac` command and its short `ca` alias to `codealmanac.cli.main:main` [@pyproject]. The [public command surface](../reference/cli/public-command-surface) is the contract that release smoke should prove from installed artifacts. The release document states that stable releases publish from `main` to the normal PyPI release channel and that version numbers must not be reused [@release-doc].

Keep the package surface narrow. Public-contract tests reject npm release language, old install surfaces, hosted commands, undeclared legacy aliases, and public SDK or MCP modules [@public-contract-tests]. If those tests fail, fix the public contract before publishing.

## Build And Smoke

Run the standard release gates from the release checkout:

```bash
git status --short
uv run pytest
uv run ruff check .
git diff --check
rm -rf dist
uv build --out-dir dist
uvx twine check dist/*
```

Then install both artifacts into clean Python 3.12 environments and smoke both installed command names [@release-doc]. Confirm that `codealmanac --version` and `ca --version` return the same version. For product behavior, use an installed artifact command from those temporary environments, not a command from the repo developer environment.

Use current public syntax during smoke checks. `sync status` accepts `--wiki`, `--from`, and `--json`; it does not accept `--quiet` [@run-parser]. The release document may lag the parser, so trust parser-backed command syntax when a smoke command disagrees with the installed CLI [@release-doc] [@run-parser].

Viewer smoke should hit packaged assets that exist in `src/codealmanac/server/assets/` and `src/codealmanac/server/assets/viewer/` [@server-assets]. `RELEASE.md` asks the release smoke to confirm `/api/overview` and `/app.js` from the local server before publishing [@release-doc].

## Publish

Publish only after the gates and installed-artifact smoke pass. The basic PyPI command is:

```bash
uvx twine upload dist/*
```

Do not commit tokens or print secret values. `RELEASE.md` allows credentials to come from local keyring, `.pypirc`, or environment, and says not to add a CI publish path until token ownership and release provenance are decided [@release-doc].

## Verify The Public Install Path

After upload, verify PyPI. `RELEASE.md` uses `python -m pip index versions codealmanac` as the basic uploaded-version check, while `pyproject.toml` defines the package's Python version floor [@release-doc] [@pyproject].

The final public-path check installs the package the way a user would, from a clean environment, and confirms the entrypoint:

```bash
uv tool install codealmanac@latest
codealmanac --version
```

The README's quickstart uses this same `uv tool install codealmanac@latest` path [@readme]; `python -m pip install codealmanac` is the documented fallback. There is no curl-based installer — `tests/test_public_contract.py` forbids the fragment `curl -fsSL` from ever appearing in the README, so that surface must never come back as the public install path [@public-contract-tests]. Treat the release as complete only after the installed package resolves to the uploaded version and `codealmanac --version` reports the expected version from the user-facing binary [@readme].

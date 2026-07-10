---
title: Release Package
topics: [guides, release, product]
sources:
  - id: release-doc
    type: file
    path: RELEASE.md
    note: Python package release checklist and public-surface constraints; package data is cross-checked against pyproject.toml.
  - id: pyproject
    type: file
    path: pyproject.toml
    note: Package name, version, Python requirement, dependencies, script entrypoint, and package data.
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

Use this guide when publishing the `codealmanac` Python package to PyPI. A release publishes the local CLI package and its packaged resources; it follows the [Local-only Python product](../decisions/local-only-python-product) decision and does not publish a hosted service, npm package, SDK, MCP package, or legacy command alias [@release-doc] [@public-contract-tests]. The release is not done when PyPI accepts files. It is done when clean installed artifacts and the public install path can run the `codealmanac` command outside the repo developer environment [@release-doc] [@readme].

## Preconditions

Start from a clean checkout of the release branch. `pyproject.toml` owns the package version, requires Python 3.12 or newer, and exposes exactly one console script: `codealmanac = "codealmanac.cli.main:main"` [@pyproject]. The [public command surface](../reference/cli/public-command-surface) is the contract that release smoke should prove from installed artifacts. The release document states that stable releases publish from `main` to the normal PyPI release channel and that version numbers must not be reused [@release-doc].

Keep the package surface narrow. Public-contract tests reject npm release language, old install surfaces, hosted commands, legacy aliases, and public SDK or MCP modules [@public-contract-tests]. If those tests fail, fix the public contract before publishing.

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

Then install both artifacts into clean Python 3.12 environments and smoke the installed command [@release-doc]. For product behavior, use the installed artifact command from those temporary environments or the user-facing installed `codealmanac` binary, not a command from the repo developer environment.

Use current public syntax during smoke checks. `sync status` accepts `--wiki`, `--from`, and `--json`; it does not accept `--quiet` [@run-parser]. The release document may lag the parser, so trust parser-backed command syntax when a smoke command disagrees with the installed CLI [@release-doc] [@run-parser].

Viewer smoke should hit packaged assets that exist in `src/codealmanac/server/assets/` and `src/codealmanac/server/assets/viewer/` [@server-assets]. `RELEASE.md` asks the release smoke to confirm `/api/overview` and `/app.js` from the local server before publishing [@release-doc].

## Publish

Publish only after the gates and installed-artifact smoke pass. The basic PyPI command is:

```bash
uvx twine upload dist/*
```

Do not commit tokens or print secret values. `RELEASE.md` allows credentials to come from local keyring, `.pypirc`, or environment, and says not to add a CI publish path until token ownership and release provenance are decided [@release-doc].

## Verify The Public Install Path

After upload, verify PyPI and the install script. `RELEASE.md` uses `python -m pip index versions codealmanac` as the basic uploaded-version check, while `pyproject.toml` defines the package's Python version floor [@release-doc] [@pyproject].

The final public-path check is the curl installer:

```bash
curl -fsSL https://codealmanac.com/install.sh | sh
codealmanac --version
```

The README documents the same install path for users [@readme]. Treat the release as complete only after the installer uses the uploaded package and `codealmanac --version` reports the expected version from the user-facing binary [@readme].

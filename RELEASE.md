# Releasing codealmanac

This file describes the Python package release flow for `codealmanac`.

CodeAlmanac v1 is local-only. A release publishes the Python CLI package; it
does not publish a hosted service, hosted capture path, SDK, MCP package, npm
package, or compatibility alias.

## Release Channels

| Channel | Branch | Version shape | Publish target |
|---|---|---|---|
| stable | `main` | `0.1.1` | PyPI default release |
| dev | `dev` | `0.1.1.dev0` | PyPI pre-release |

Stable users install the normal PyPI release:

```bash
uv tool install codealmanac
python -m pip install codealmanac
```

Dev users must opt into a pre-release:

```bash
uv tool install --prerelease allow codealmanac
python -m pip install --pre codealmanac
```

## Pre-Release Checklist

Run from a clean checkout of the release branch:

```bash
git status --short
uv run pytest
uv run ruff check .
git diff --check
rm -rf dist
uv build --out-dir dist
uvx twine check dist/*
```

Then install the built artifacts into clean Python 3.12 environments and smoke
the installed CLI:

```bash
python3.12 -m venv /tmp/codealmanac-wheel-venv
/tmp/codealmanac-wheel-venv/bin/python -m pip install dist/*.whl
/tmp/codealmanac-wheel-venv/bin/codealmanac --help

python3.12 -m venv /tmp/codealmanac-sdist-venv
/tmp/codealmanac-sdist-venv/bin/python -m pip install dist/*.tar.gz
/tmp/codealmanac-sdist-venv/bin/codealmanac --help
```

For a full local smoke, use a temp `HOME` and temp repo, then run:

```bash
codealmanac init <repo> --name release-smoke
codealmanac search getting
codealmanac show getting-started --lead
codealmanac topics
codealmanac health --json
codealmanac jobs
codealmanac sync status --from codex --quiet 0s
codealmanac doctor --json
codealmanac serve --host 127.0.0.1 --port 49280
```

Confirm `/api/overview` and `/app.js` respond from the local server.

## Publish

Publish only after the checklist passes and the release commit is on the
release branch.

```bash
uvx twine upload dist/*
```

Verify the uploaded version:

```bash
python -m pip index versions codealmanac
```

Do not upload a `dev` version as the stable release. If a bad release is
published, fix forward with a new version.

## Versioning Policy

CodeAlmanac is pre-1.0.

- Breaking changes bump minor: `0.1.x` -> `0.2.0`.
- Features and fixes bump patch: `0.1.0` -> `0.1.1`.
- Dev builds use PEP 440 dev releases: `0.1.1.dev0`, `0.1.1.dev1`.
- Release candidates are allowed when needed: `0.1.1rc1`.

Do not reuse a published version number.

## Package Surface

The package must expose exactly one public command:

```text
codealmanac
```

The published artifact must include:

- `README.md`
- `LICENSE.md`
- `src/codealmanac/server/assets/`
- `src/codealmanac/server/assets/viewer/`
- `src/codealmanac/manual/*.md`
- `src/codealmanac/prompts/base/*.md`
- `src/codealmanac/prompts/operations/*.md`

The published artifact must not introduce:

- public `almanac` or `alm` commands
- public `capture`, `login`, `connect`, or `upload` commands
- public SDK or MCP modules
- npm, Node, or hosted-dashboard install instructions

## Secrets

PyPI upload credentials belong in the maintainer's local keyring, `.pypirc`, or
environment. Do not commit tokens. Do not add a CI publish path until release
provenance and token ownership are explicitly decided.

# Releasing codealmanac

This file describes the Python package release flow for `codealmanac`.

A release publishes the Python CLI package to PyPI. The hosted web/backend
service is deployed from `codealmanac-hosted`; this repo publishes the user
machine CLI that can talk to cloud and can also run local wiki workflows.

This release does not publish an SDK, MCP package, JavaScript package, or
compatibility alias.

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
uv tool install "codealmanac==0.1.1.dev0"
python -m pip install "codealmanac==0.1.1.dev0"
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

## One-Time PyPI Trusted Publisher Setup

The release workflow uses PyPI Trusted Publishing. It does not require a PyPI
API token in chat, Doppler, GitHub secrets, or a local `.pypirc`.

Configure this once in the PyPI `codealmanac` project:

```text
Publisher: GitHub
PyPI project: codealmanac
Owner: AlmanacCode
Repository name: codealmanac
Workflow filename: publish.yml
Environment name: pypi
```

If PyPI returns `invalid-publisher`, the failed workflow log prints the OIDC
claims. The expected stable release claims are:

```text
sub: repo:AlmanacCode/codealmanac:environment:pypi
repository: AlmanacCode/codealmanac
repository_owner: AlmanacCode
workflow_ref: AlmanacCode/codealmanac/.github/workflows/publish.yml@refs/heads/main
ref: refs/heads/main
environment: pypi
```

The GitHub workflow uses the `pypi` environment. Configure protection rules on
that GitHub environment if releases should require manual approval inside
GitHub Actions.

## Publish

Publish only after the checklist passes and the release commit is on the
release branch.

Stable releases are published from `main` through the manual GitHub Actions
workflow `.github/workflows/publish.yml`.

1. Push the release commit to `main`.
2. Open GitHub Actions -> `publish`.
3. Run the workflow from branch `main`.
4. Enter the exact version from `pyproject.toml` as `confirm_version`.

The workflow refuses non-`main` refs, refuses version mismatches, refuses
pre-release versions, runs pytest/ruff/diff hygiene, builds artifacts, checks
them with Twine, then publishes with
`pypa/gh-action-pypi-publish@release/v1`.

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

The package must expose exactly one public executable:

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
- public SDK or MCP modules
- npm, Node, or hosted-dashboard install instructions

## Secrets

Do not commit PyPI tokens. Do not add PyPI tokens to Doppler or GitHub secrets
for the standard release path. PyPI Trusted Publishing uses GitHub OIDC through
the official PyPA publishing action.

If Trusted Publishing is unavailable during an incident, a maintainer may use a
local token with `uvx twine upload dist/*` after the same release checklist
passes. That is an emergency fallback, not the default release path.

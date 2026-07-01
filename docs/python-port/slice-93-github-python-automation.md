# Slice 93 - GitHub Python Automation

Date: 2026-07-01

## Purpose

Remove the remaining Node/npm GitHub automation and template surface from the
Python rewrite.

## Finding

`RELEASE.md`, `README.md`, and `CONTRIBUTING.md` already describe the Python
local product, but `.github/` still described the archived package era:

- CI installed Node 20/22 and ran `npm ci`, `npm run build`, `npx tsc`, and
  `npm test`.
- `pack-check.yml` ran `npm pack --dry-run`.
- `publish.yml` discussed `NPM_TOKEN`, npm Sigstore, and a local npm publish
  skill.
- The PR and bug templates asked maintainers to paste npm commands, Node
  versions, `npx`, and npm install methods.

That would make the first public branch or PR report the wrong product shape.

## Design

Treat GitHub automation as a public project entrypoint. It should execute the
same Python gates a contributor runs locally and the same package check the
release guide names.

```text
github.ci
  -> setup Python 3.12
  -> setup uv
  -> uv sync --locked
  -> uv run ruff check .
  -> uv run pytest
  -> uv run codealmanac --help
  -> git diff --check

github.package_check
  -> setup Python 3.12
  -> setup uv
  -> uv sync --locked
  -> uv build --out-dir dist
  -> uvx twine check dist/*
```

`publish.yml` remains a disabled manual workflow. The project still does not
have an agreed CI publish policy, PyPI Trusted Publishing configuration, or
release provenance decision.

## Cosmic Python Note

The project-structure appendix says common commands should be available to "a
developer (or a CI server)" and that code-backed entrypoints have "less
tendency to become out of date" than docs. The transfer here is that CI is
part of the product contract: when docs say uv/PyPI but GitHub runs npm, the
entrypoint is stale code, not harmless text.

Reference: `docs/reference/cosmic-python/appendix_project_structure.md`.

## Planned Changes

- Rewrite `.github/workflows/ci.yml` for uv/Python gates.
- Rewrite `.github/workflows/pack-check.yml` as a Python package check.
- Rewrite `.github/workflows/publish.yml` as a disabled PyPI publish placeholder.
- Rewrite GitHub PR and issue templates to say CodeAlmanac, Python, uv/pip, and
  configured Almanac root.
- Ignore local `build/` artifacts created by setuptools package builds.
- Add public-contract tests that reject npm-era GitHub automation and template
  language.
- Update steering docs after verification.

## Verification Plan

- `uv run pytest tests/test_public_contract.py`
- `uv run ruff check tests/test_public_contract.py`
- `uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice93`
- `git check-ignore build/`
- `git diff --check`
- `uv run pytest`
- `uv run ruff check .`

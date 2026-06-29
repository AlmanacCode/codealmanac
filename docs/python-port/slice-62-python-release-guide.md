# Slice 62 - Python Release Guide

Date: 2026-06-29

## Purpose

Remove the stale npm release path before public Python packaging.

## Finding

`RELEASE.md` still described the archived Node/npm release process:

- `npm test`
- `npm run build`
- `npm pack --dry-run`
- `npm publish`
- npm dist-tags and `NPM_TOKEN`

That contradicted the current Python package surface and would mislead a
maintainer even though the wheel and sdist rehearsal passed.

## Change

`RELEASE.md` now describes the Python release path:

- `uv run pytest`
- `uv run ruff check .`
- `git diff --check`
- `uv build --out-dir dist`
- `uvx twine check dist/*`
- clean Python 3.12 wheel and sdist install smoke
- `uvx twine upload dist/*`

`pyproject.toml` now includes PyPI-facing metadata:

- `authors = [{ name = "Almanac" }]`
- keywords
- Trove classifiers
- repository and issue URLs
- no license classifier, because PEP 639 SPDX `license = "Apache-2.0"`
  supersedes license classifiers in current setuptools

`tests/test_public_contract.py` now guards the Python release guide and package
metadata so stale npm release instructions do not return.

## Cosmic Python Note

The epilogue says to prioritize architectural cleanup by the problem it solves.
Here the problem was not a missing service seam. The release path was an
entangled responsibility left from the archived package era. Fixing the
maintainer-facing operation document keeps the supported use case named and
bounded before adding any release machinery.

## Result

The release surface now matches the Python local product:

- one CLI command: `codealmanac`
- PyPI package release path
- no npm release path
- no hosted, cloud capture, SDK, MCP, or compatibility alias release surface

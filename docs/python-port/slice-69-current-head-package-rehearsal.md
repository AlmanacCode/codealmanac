# Slice 69 - Current Head Package Rehearsal

Date: 2026-06-30

## Scope

Repeat the package rehearsal from current `dev` HEAD after slices 62 through 68.

## Finding

The public beta audit still marked fresh install and package metadata as
needing a final rerun. Earlier package proof existed from slice 61, but several
documentation, metadata, and public-contract slices had landed after that.

## Rehearsal

Build output:

```text
/tmp/codealmanac-release-slice69/codealmanac-0.1.0-py3-none-any.whl
/tmp/codealmanac-release-slice69/codealmanac-0.1.0.tar.gz
```

Checks:

- `uv build --out-dir /tmp/codealmanac-release-slice69`
- `uvx twine check /tmp/codealmanac-release-slice69/*`
- stdlib wheel/sdist inspection for README, Apache-2.0 license metadata,
  license file, server assets, viewer modules, manual docs, and prompt docs
- clean uv-managed Python 3.12.9 venv install from wheel
- clean uv-managed Python 3.12.9 venv install from sdist
- installed CLI smoke for both artifacts:
  - `codealmanac --help`
  - `codealmanac init`
  - `codealmanac search getting`
  - `codealmanac show getting-started --lead`
  - `codealmanac topics`
  - `codealmanac health --json`
  - `codealmanac jobs`
  - `codealmanac sync status --from codex --quiet 0s`
  - `codealmanac doctor --json`
  - `codealmanac serve` with `/api/overview` and `/app.js`
  - `codealmanac update --check --json`

`python3.12` was not on `PATH` in this shell. `uv python find 3.12` resolved
CPython 3.12.9, so the clean install smoke used `uv venv --python 3.12` and
`uv pip install --python <venv>/bin/python ...`.

## Decision

`docs/python-port/public-beta-gate-audit.md` now marks `Fresh install` and
`Package metadata` as ready. The remaining public beta product blocker is one
more real lifecycle dogfood pass against a non-toy project source shape.

## Guard

`tests/test_public_contract.py` now asserts the public beta gate audit records
slice 69 for `Fresh install` and `Package metadata`, and no longer says those
rows need a final rerun.

## Cosmic Python Note

The project-structure appendix states that application code lives under `src`
and must be made pip-installable. This slice applies that packaging boundary:
editable-checkout tests are not enough for release confidence, so the release
gate installs the built wheel and sdist into clean environments and exercises
the installed console script.

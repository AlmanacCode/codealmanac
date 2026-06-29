# Slice 61 - Final Package Rehearsal

Date: 2026-06-29

## Purpose

Prove the Python package works from built artifacts, not from the editable
checkout.

## Scope

- Build both wheel and sdist.
- Inspect package metadata and bundled resources.
- Install wheel and sdist into clean Python 3.12 environments.
- Run installed `codealmanac` smoke checks against fresh temp homes and repos.
- Patch only packaging issues exposed by the rehearsal.

## Package Metadata Fix

The first build succeeded but emitted a setuptools deprecation warning for the
old TOML-table license metadata:

```text
project.license as a TOML table is deprecated
```

`pyproject.toml` now uses SPDX metadata:

```toml
license = "Apache-2.0"
license-files = ["LICENSE.md"]
```

The build backend requirement moved to `setuptools>=77.0.3`, matching the
setuptools release line that supports the modern license fields documented by
the [Python Packaging User Guide](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/).

## Build Evidence

Command:

```text
uv build --out-dir /tmp/codealmanac-release-slice61
```

Artifacts:

```text
/tmp/codealmanac-release-slice61/codealmanac-0.1.0-py3-none-any.whl
/tmp/codealmanac-release-slice61/codealmanac-0.1.0.tar.gz
```

Artifact inspection confirmed:

- wheel metadata name `codealmanac`
- version `0.1.0`
- `License-Expression: Apache-2.0`
- `License-File: LICENSE.md`
- console script `codealmanac = codealmanac.cli.main:main`
- README, license text, server assets, manual files, and prompts included
- sdist includes the same public source and package-data surface

## Install Evidence

The first install attempt with system Python 3.11 failed as intended:

```text
Package 'codealmanac' requires a different Python: 3.11.10 not in '>=3.12'
```

Clean Python 3.12.9 virtualenv installs passed for both artifacts:

```text
/tmp/codealmanac-release-slice61/wheel-venv
/tmp/codealmanac-release-slice61/sdist-venv
```

Both installed CLIs rendered `codealmanac --help` with:

```text
usage: codealmanac [-h] [--version]
```

## Installed CLI Smoke

Both clean installs passed the same local smoke flow:

- `init <repo> --name <label>`
- Git init and commit of the starter wiki
- `search getting`
- `show getting-started --lead`
- `topics`
- `health --json`
- `jobs`
- `sync status --from codex --quiet 0s`
- `doctor --json`
- `serve --host 127.0.0.1 --port <port>`
- HTTP checks for `/api/overview` and `/app.js`

Observed command shapes:

- `show --lead` for the starter page returns `# Getting Started`.
- `topics` lists the `concepts` topic.
- `jobs` exits cleanly with empty stdout when no jobs exist.
- `sync status` returns zero counters for an empty transcript scan.
- `doctor --json` returns section arrays keyed by values such as
  `install.manual` and `wiki.health`.
- `/api/overview` uses top-level `page_count` and `topic_count`.
- `/app.js` imports the served viewer module from `/assets/viewer/main.js`.

Final installed smoke output:

```text
wheel-install: ok
sdist-install: ok
```

## Result

The release-package rehearsal gate now has wheel, sdist, clean install,
metadata, package-data, CLI, local viewer, and Python-version evidence.

No hosted, cloud capture, SDK, MCP, alias, or compatibility surface was added.

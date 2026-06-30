# Slice 71 - Current Head Package Smoke

Date: 2026-06-30

## Purpose

Rerun package/install proof after slice 70 changed README package metadata and
the default user-state path. The release gate says package smoke must be rerun
when README, package data, prompts, manual docs, server assets, or installed
behavior changes.

## Scope

- Build current-head wheel and sdist artifacts.
- Run `twine check`.
- Inspect package metadata and package data.
- Install wheel and sdist into clean Python 3.12 environments.
- Run installed CLI smoke for the local read surface, jobs, sync status,
  doctor, update check, and serve.
- Prove installed `init` writes `~/.codealmanac/registry.json` and not
  `~/.almanac/registry.json`.

## Evidence

Artifacts:

```text
/tmp/codealmanac-release-slice71/codealmanac-0.1.0-py3-none-any.whl
/tmp/codealmanac-release-slice71/codealmanac-0.1.0.tar.gz
```

`uv build --out-dir /tmp/codealmanac-release-slice71` built both artifacts.
`uvx twine check /tmp/codealmanac-release-slice71/*` passed for wheel and
sdist.

Package inspection found:

```text
wheel_missing= []
wheel_license= Apache-2.0
wheel_requires_python= >=3.12
wheel_readme_state_root= True
sdist_missing= []
```

The inspection covered README metadata, Apache-2.0 license metadata, the
license file, `codealmanac/core/paths.py`, server viewer assets, manual docs,
and ingest prompt docs.

Clean installs:

```text
uv venv --python 3.12 /tmp/codealmanac-wheel-slice71
uv pip install --python /tmp/codealmanac-wheel-slice71/bin/python \
  /tmp/codealmanac-release-slice71/codealmanac-0.1.0-py3-none-any.whl

uv venv --python 3.12 /tmp/codealmanac-sdist-slice71
uv pip install --python /tmp/codealmanac-sdist-slice71/bin/python \
  /tmp/codealmanac-release-slice71/codealmanac-0.1.0.tar.gz
```

Both installed into CPython 3.12.9 environments.

## Installed CLI Smoke

Wheel and sdist installs each ran:

```text
codealmanac --help
codealmanac init . --name <kind>-install
codealmanac search getting
codealmanac show getting-started --lead
codealmanac topics
codealmanac health --json
codealmanac jobs
codealmanac sync status --from codex --quiet 0s
codealmanac doctor --json
codealmanac update --check --json
codealmanac serve --host 127.0.0.1 --port <port>
curl /api/overview
curl /assets/viewer/main.js
```

For both installed artifacts:

- `search getting` returned `getting-started`.
- `show --lead` rendered `# Getting Started`.
- `health --json` reported no orphans, dead refs, broken links, broken
  cross-wiki links, empty topics, or empty pages.
- `sync status` scanned zero transcripts and reported no ready or
  needs-attention work.
- `serve` returned overview JSON containing `getting-started` and served the
  viewer module.
- `update --check --json` reported a non-editable `uv-tool` update plan.
- `doctor --json` reported `codealmanac 0.1.0`, Python 3.12.9, and the
  registry under the temp `~/.codealmanac/registry.json`.

## State Path Proof

Wheel smoke created:

```text
/tmp/codealmanac-install-smoke-slice71/wheel/home/.codealmanac/registry.json
```

Sdist smoke created:

```text
/tmp/codealmanac-install-smoke-slice71/sdist/home/.codealmanac/registry.json
```

Both smokes asserted that `~/.almanac/registry.json` did not exist in the temp
home. `init` stderr printed the new registry path for both artifacts.

## Result

Current-head package proof is fresh after the slice 70 state-path change. The
remaining public-release work is operational: version/changelog, PyPI
credentials, publish ownership, and the human publish decision.

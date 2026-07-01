# Slice 138: Current Head Release Smoke

## Goal

Prove current `dev` HEAD still builds, installs, and runs as a clean Python
package after the Codex app-server and Claude SDK dogfood slices.

## Why This Slice

The active goal is now near the diminishing-returns line. Slice 136 and slice
137 proved the default rich provider harnesses through real runs, but public
release readiness still depends on the artifact a user installs, not the
editable checkout.

Cosmic Python chapter 5 frames this as high-gear verification: use the public
application surface for broad confidence, while the existing service and adapter
tests keep lower-level design feedback. The release smoke uses the built wheel
and sdist, then drives the installed `codealmanac` command.

## Scope

In scope:

- Build current-head wheel and sdist.
- Run `twine check`.
- Inspect wheel/sdist metadata and package data.
- Install wheel and sdist into clean Python 3.12 environments.
- Run installed CLI smoke for init, search, show, topics, health, jobs,
  sync status, doctor, update check, and serve HTTP routes.
- Update release-readiness, gate audit, verification matrix, worklog, and
  next-agent brief with exact evidence.

Out of scope:

- Publishing to PyPI.
- Version bumping or changelog authoring.
- Hosted/cloud behavior.
- More prompt-quality lifecycle dogfood.

## Verification

```bash
uv run pytest
uv run ruff check .
git diff --check
rm -rf /tmp/codealmanac-release-slice138
uv build --out-dir /tmp/codealmanac-release-slice138
uvx twine check /tmp/codealmanac-release-slice138/*
uv run python <artifact inspection and installed CLI smoke>
```

## Outcome

Current `dev` HEAD built and installed as `codealmanac 0.1.0.dev0`.

Artifacts:

- `/tmp/codealmanac-release-slice138/codealmanac-0.1.0.dev0-py3-none-any.whl`
- `/tmp/codealmanac-release-slice138/codealmanac-0.1.0.dev0.tar.gz`

Artifact checks:

- `uv build --out-dir /tmp/codealmanac-release-slice138` built wheel and sdist.
- `uvx twine check /tmp/codealmanac-release-slice138/*` passed for both.
- Wheel metadata: name `codealmanac`, version `0.1.0.dev0`, license
  `Apache-2.0`, `Requires-Python: >=3.12`.
- Wheel README metadata mentions `uv tool install codealmanac` and
  `~/.codealmanac/`.
- Wheel package data included server assets, viewer modules, manual docs,
  prompts, setup guide, and license file.
- Sdist package data included README, license, `pyproject.toml`, server assets,
  viewer module, manual docs, and ingest prompt.

Installed smoke:

- Both wheel and sdist installed into clean uv-managed Python 3.12.9
  environments.
- Both installed CLIs ran `--help`, `init`, `search getting`, `show
  getting-started --lead`, `topics`, `health --json`, `jobs`, `sync status
  --from codex --quiet 0s --json`, `doctor --json`, `update --check --json`,
  and `serve`.
- Both smokes used isolated temp homes and wrote registry state to
  `~/.codealmanac/registry.json`, not `~/.almanac/registry.json`.
- `search getting` returned `getting-started`.
- `health --json` reported zero findings.
- `sync status --json` reported zero ready transcript ranges in the isolated
  home.
- `update --check --json` returned `status: "ready"` with a uv-tool foreground
  update command.
- `serve` returned `/api/overview` with `page_count: 1` and served
  `/assets/viewer/main.js`.

The first full `uv run pytest` after adding the slice plan failed only because
`next-agent-brief.md` still named slice 137 as latest. That is the intended
public-contract freshness guard for new slice docs.

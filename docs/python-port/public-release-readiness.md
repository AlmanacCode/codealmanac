# Public Release Readiness

Date: 2026-06-29

## Current Read

CodeAlmanac is usable as an internal local alpha. Clean wheel install, final
wheel/sdist package rehearsal, real Codex ingest, real Claude ingest, real
sync, and final viewer browser proof now have dogfood evidence.

The main remaining work is public-release judgment, prompt quality, and
real-world dogfood. More generic architecture seams are diminishing returns
unless a gate below exposes a boundary problem.

## Public Beta Gate

| Area | Required Evidence |
|---|---|
| Fresh install | Build a wheel, install it into a clean environment, run `codealmanac --help`, `init`, `search`, `show`, `health`, `serve`, and `jobs` without relying on editable checkout state. |
| Package metadata | Wheel metadata includes README and Apache-2.0 license text; package data includes server assets, manual files, and prompts. |
| Public docs | `README.md` describes only the Python `codealmanac` local surface: no Node/npm install path, no `almanac` alias, no hosted dashboard happy path. |
| Release guide | `RELEASE.md` describes the Python/PyPI release path, clean artifact install smoke, and no npm/Node release flow. |
| Local wiki read path | A new repo can initialize, search, show a page, inspect topics, run health, and serve the local viewer. |
| Lifecycle write path | Real Codex or Claude ingest writes useful wiki changes under the configured Almanac root and leaves readable `jobs logs`. |
| Sync path | A synthetic and a real local transcript can be discovered, claimed, ingested, and skipped on a second run. |
| Safety | Lifecycle runs reject non-wiki mutations, preserve dirty app files, and record harness events before terminal errors. |
| Viewer | Browser dogfood checks desktop and mobile routes for overview, page, topic, search, file refs, and no horizontal overflow. |
| Contract guards | Tests reject hosted verbs, compatibility aliases, public SDK/MCP modules, and stale README install language. |
| Release command | `codealmanac update --check` reports a coherent package-manager plan from non-editable pip and uv-tool installs. |

## Stop Doing

- Do not add hosted verbs, login/connect/upload, SDK, MCP, or aliases.
- Do not add a frontend build step until the static viewer becomes the harder
  path.
- Do not port Codex app-server for parity. Port it only when normalized harness
  event completeness is required.
- Do not add a source pool or candidate object without a concrete product
  workflow that needs it.

## Evidence So Far

- Slice 56 passed clean wheel install from a built wheel, package metadata and
  package-data inspection, public README contract tests, and local read/viewer
  smoke checks.
- Slice 57 passed real Codex ingest through `IngestWorkflow` and
  `CodexCliHarnessAdapter` in an isolated temp repo. The first run exposed
  broken page links from over-eager entity wikilinking. Prompt/manual guidance
  now forbids unresolved page links, and the second real Codex run produced a
  health-clean page for the same source shape.
- Slice 57 also removed default empty-topic health noise from newly initialized
  starter wikis.
- Slice 58 passed real Claude ingest through `IngestWorkflow` and
  `ClaudeCliHarnessAdapter` in an isolated temp repo. The run produced a
  health-clean page, updated topics, and left readable public CLI `jobs logs`,
  `search`, `show`, and `health --json` output.
- Slice 59 passed real foreground sync against a temp Codex transcript. Sync
  discovered the transcript, started a real Claude-backed ingest, advanced the
  ledger to done, skipped the same transcript as unchanged on the second
  status run, and left public CLI `sync status`, `jobs logs`, `jobs show`,
  `search`, `show`, and `health --json` output readable.
- Slice 60 passed browser-harness proof over a live temp `serve` instance.
  Overview, page, topic, search, and file-reference routes rendered in desktop
  Chrome with no horizontal overflow, and the mobile `390x844` page route also
  rendered without horizontal overflow.
- Slice 61 passed final package rehearsal. Built wheel and sdist artifacts,
  inspected metadata/package data, installed both into clean Python 3.12.9
  environments, ran installed CLI smoke checks for `init`, `search`, `show`,
  `topics`, `health`, `jobs`, `sync status`, `doctor`, and `serve`, and
  confirmed Python 3.11 is rejected by `requires-python`.
- Slice 61 also updated package metadata to SPDX `Apache-2.0` plus
  `license-files = ["LICENSE.md"]`, removing the setuptools license-table
  deprecation warning.
- Slice 62 replaced the stale npm release guide with the Python/PyPI release
  guide, added PyPI-facing project metadata, verified wheel/sdist metadata with
  `twine check`, and extended public-contract tests so npm release commands do
  not return.

## Next Useful Pressure Tests

1. Product/release review against this gate before any publish attempt.
2. More lifecycle prompt-quality dogfood against real project source shapes.

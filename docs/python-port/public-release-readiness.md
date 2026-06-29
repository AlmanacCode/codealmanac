# Public Release Readiness

Date: 2026-06-29

## Current Read

CodeAlmanac is usable as an internal local alpha. Clean wheel install, real
Codex ingest, and real Claude ingest now have dogfood evidence. It is not
public-release ready until real sync, final viewer browser proof, and
release-package rehearsal also pass.

The main remaining work is release proof, prompt quality, and real-world
dogfood. More generic architecture seams are diminishing returns unless a gate
below exposes a boundary problem.

## Public Beta Gate

| Area | Required Evidence |
|---|---|
| Fresh install | Build a wheel, install it into a clean environment, run `codealmanac --help`, `init`, `search`, `show`, `health`, `serve`, and `jobs` without relying on editable checkout state. |
| Package metadata | Wheel metadata includes README and Apache-2.0 license text; package data includes server assets, manual files, and prompts. |
| Public docs | `README.md` describes only the Python `codealmanac` local surface: no Node/npm install path, no `almanac` alias, no hosted dashboard happy path. |
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

## Next Useful Pressure Tests

1. Real sync against a local transcript, then second-run skip proof.
2. Browser-harness pass over `serve` after the latest viewer/static package.
3. Final wheel/sdist install rehearsal before any publish attempt.

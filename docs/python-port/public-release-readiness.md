# Public Release Readiness

Date: 2026-06-30

## Current Read

CodeAlmanac is usable as an internal local alpha. Clean wheel install, final
wheel/sdist package rehearsal, real Codex ingest, real Claude ingest, real
sync, and final viewer browser proof now have dogfood evidence.

The gate audit in `docs/python-port/public-beta-gate-audit.md` is the current
release-readiness checkpoint. The main remaining work is final current-head
package rehearsal and one more real lifecycle dogfood pass against a non-toy
project source shape. More generic architecture seams are diminishing returns
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
- Slice 63 fixed a real local dogfood hygiene bug: `doctor` and read commands
  no longer create a derived-only `almanac/index.db` for a registered workspace
  whose configured root has not been built. Registry status, root discovery,
  and index opening now require source wiki markers rather than directory
  existence.
- Slice 64 corrected the public README's scaffold tree after live `init`
  dogfood showed it mixed initialized wiki source files with later runtime
  state. The README now separates init-created source files from derived
  `index.db`/`jobs/` state, and public-contract tests guard the distinction.
- Slice 65 dogfooded the README quickstart in a fresh temp repo. The old
  `search "auth"` example returned zero results after `init`; the quickstart
  now searches `getting`, which returns the starter `getting-started` page.
- Slice 66 checked README lifecycle examples against the source abstraction.
  The local-file ingest example now uses `README.md`, which resolves as a real
  file in this repo, while the GitHub PR shorthand remains parser/source
  supported.
- Slice 67 made the next-agent brief an executable continuation contract.
  Public-contract tests now require the brief's current-state section to track
  the newest `docs/python-port/slice-N-*.md` file.
- Slice 68 audited every public beta gate in
  `docs/python-port/public-beta-gate-audit.md` and added a public-contract
  test that forces the audit to cover every row in the release gate table.

## Next Useful Pressure Tests

1. Repeat current-head package rehearsal before any publish attempt.
2. Run one more real lifecycle prompt-quality dogfood pass against a non-toy
   project source shape.

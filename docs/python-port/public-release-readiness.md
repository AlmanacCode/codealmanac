# Public Release Readiness

Date: 2026-06-30

## Current Read

CodeAlmanac's local Python implementation has public-beta gate coverage. Clean
wheel install, final wheel/sdist package rehearsal, real Codex ingest, real
Claude ingest, real Codex app-server harness dogfood, real Claude SDK harness
dogfood, real non-toy source-shape ingest, real sync, and final viewer browser
proof now have evidence. Slice 93 also aligns GitHub CI, package-check,
disabled publish placeholders, and issue/PR templates with the Python/PyPI
surface.

The gate audit in `docs/python-port/public-beta-gate-audit.md` is the current
release-readiness checkpoint. Slice 70 passed the remaining lifecycle
prompt-quality dogfood and fixed the user-state path issue it exposed. Slice 71
reran current-head package/install proof after that change. Remaining
public-release work is release operations: PyPI credentials, version/changelog,
and the human publish decision.

## Public Beta Gate

| Area | Required Evidence |
|---|---|
| Fresh install | Build a wheel, install it into a clean environment, run `codealmanac --help`, `init`, `search`, `show`, `health`, `serve`, and `jobs` without relying on editable checkout state. |
| Package metadata | Wheel metadata includes README and Apache-2.0 license text; package data includes server assets, manual files, and prompts. |
| Public docs | `README.md` describes only the Python `codealmanac` local surface: no Node/npm install path, no `almanac` alias, no hosted dashboard happy path. |
| Release guide | `RELEASE.md` describes the Python/PyPI release path, clean artifact install smoke, and no npm/Node release flow. |
| GitHub automation | GitHub workflows and templates use Python 3.12, uv, pytest, ruff, package build, `twine check`, and PyPI language, with no npm/Node/npx automation path. |
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
- Do not add more provider transports for parity. Codex app-server is now the
  default Codex path because normalized harness event completeness is required;
  further transport work should answer a concrete product gap.
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
- Slice 69 reran current-head package rehearsal. Wheel and sdist artifacts
  passed `twine check`, metadata/package-data inspection, clean Python 3.12.9
  installs, installed CLI smoke, live `serve` HTTP checks, and installed
  `update --check`.
- Slice 70 ran real Claude-backed `codealmanac ingest` against a focused temp
  repo containing CodeAlmanac source-runtime, filesystem adapter, ingest
  workflow, prompt, and live-agreement files. It created
  `source-runtime-flow.md`, left health clean, and produced readable job logs.
- Slice 70 also moved default user/global state from `~/.almanac/` to
  `~/.codealmanac/`, while preserving the repo wiki root as `almanac/`.
- Slice 71 reran current-head package proof after the slice 70 state-path and
  README changes. Wheel and sdist artifacts passed `twine check`, package
  inspection confirmed the updated README/state-root metadata and package data,
  clean Python 3.12.9 installs passed installed CLI smoke, `serve` HTTP checks
  passed, and both artifacts wrote registry state under `~/.codealmanac/`.
- Slice 136 ran the default real Codex app-server harness through
  `IngestWorkflow`. The first run exposed whitespace-only text deltas from the
  real app-server; the provider edge now drops blank deltas before constructing
  `HarnessEvent`, and the rerun finished `done`, created a page, search found
  it, and health was clean.
- Slice 137 ran the default real Claude SDK harness through `IngestWorkflow`.
  The run used real HOME/Claude auth with a temp registry and temp repo,
  finished `ingest-20260701163930-cf193a0e` as `done`, created
  `release-package-smoke.md`, search found the page, health was clean, and the
  normalized event stream included provider session, text, text deltas, tool
  use/results, context usage, warning, and done.

## Next Useful Pressure Tests

1. Prepare release operations: version/changelog, PyPI credentials, and human
   publish decision.
2. Rerun package/install smoke again only if metadata, README, prompts, manual,
   server assets, or installed behavior change before publishing.

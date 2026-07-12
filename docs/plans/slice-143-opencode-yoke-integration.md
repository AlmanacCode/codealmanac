# Slice 143: OpenCode through Yoke

## Outcome

CodeAlmanac offers OpenCode as a third harness (`HarnessKind.OPENCODE`), routed
through `almanac-yoke` once Yoke ships its OpenCode provider adapter
(`AlmanacCode/Yoke`, `docs/plans/2026-07-11-opencode-provider.md`). No
provider-specific execution code is added to CodeAlmanac — that machinery
lives entirely in Yoke, per the slice-140 boundary. This slice is config,
dispatch, and setup-surface wiring only.

## Context

This repeats slice-140's shape for a third provider, not a new architecture.
An earlier branch (`feat/opencode-harness`, this repo, commit `8a39086e`)
built OpenCode as a fourth embedded harness *before* slice-140 existed —
that code (`services/harnesses/*`, `integrations/harnesses/{claude,codex,
opencode}`) is superseded and gets deleted, not ported. Its config/setup-wizard
generalization (`HARNESS_ORDER = tuple(HarnessKind)`-driven options, "provider/
model" shape validation instead of a fixed model whitelist) is reusable
near-verbatim on top of the current `integrations/harnesses/yoke/` shape and
is carried forward in this slice.

## Scope

- `services/harnesses/kinds.py`: add `HarnessKind.OPENCODE = "opencode"`.
- `services/setup/models.py`: add `SetupTarget.OPENCODE = "opencode"`.
- `services/config/models.py`: add `HARNESS_MODELS[HarnessKind.OPENCODE]` and
  `DEFAULT_HARNESS_MODELS[HarnessKind.OPENCODE]` (carry forward the spike-
  verified `opencode/deepseek-v4-flash-free` etc. entries and comments from
  `8a39086e` as-is — no re-verification this slice). Replace the
  `CONTROLLED_HARNESS_MODELS` membership check with the shape-validating
  `model_matches_harness` from that same commit (`is_opencode_model_shape`),
  since OpenCode is a router over arbitrary `provider/model` strings, not a
  fixed catalog.
- `integrations/harnesses/yoke/adapter.py`:
  - `provider_options(kind)` — currently `if CLAUDE ... else CODEX` — becomes
    an exhaustive `match kind:` over all three `HarnessKind` values. Bounded,
    closed enum; a `match` reads clearer here than a registry indirection.
  - `create_yoke_harness()`'s `surface=` ternary generalizes the same way —
    confirm with Yoke's release notes whether OpenCode needs an explicit
    `surface="opencode_server"` pin (like Codex's `codex_app_server` pin) or
    resolves as the provider's only/default surface (like Claude); only add
    the pin if Yoke doesn't already default to it.
  - `CODEX_RUN_TIMEOUT_SECONDS`-style constant for OpenCode if its run
    envelope differs from Codex's 30-minute default — confirm against the
    Yoke plan's `stuck_after_seconds` (240s stuck-tool-call threshold) rather
    than guessing a number.
- `cli/dispatch/setup_wizard/options.py`, `cli/parser/setup.py`: reapply the
  `HARNESS_ORDER = tuple(HarnessKind)` / `SHORTCUTS` / `TARGET_LABELS` /
  `RUNNER_LABELS` generalization from `8a39086e` on top of the current file
  (selection stays "all" or "exactly one," not arbitrary subsets — that
  granularity was a deliberate choice in the original commit, not revisited
  here).
- `pyproject.toml`: bump `almanac-yoke` to the version that ships the
  OpenCode provider (`>=0.1.8,<0.2` or whatever slice-141's Yoke PR
  publishes as).
- Almanac: update `almanac/architecture/agent-runs/provider-adapters.md` to
  list OpenCode as a third adapter and cross-link the Yoke wiki page.

## Out of scope

- Any HTTP/subprocess/event-parsing logic for OpenCode — that's Yoke's.
- Arbitrary multi-select harness combos in the setup wizard (still "all" or
  "one").
- Re-verifying the OpenCode model catalog against a live spike.
- OAuth-based OpenCode login (Yoke's adapter only wires `api_key` this pass).

## Verification

- `uv run pytest`, `uv run ruff check .`.
- `test_architecture.py`'s `HarnessKind` text assertion and any enum-
  completeness tests updated for the third value.
- Setup wizard: `--runner opencode`, `--runner all`, interactive flow with all
  three options rendered and shortcut keys (`c`/`l`/`o`) working.
- Config validation: a `harness.model` that isn't `"provider/model"` shaped
  under `default: opencode` fails with `OPENCODE_MODEL_SHAPE_MESSAGE`; Codex/
  Claude model validation behavior unchanged.
- Live-test one build/ingest/garden run on OpenCode once the Yoke dependency
  bump lands, alongside existing Codex/Claude live tests (no regression).

## Read before coding

- `MANUAL.md`
- `docs/plans/slice-140-yoke-runtime-integration.md`
- `almanac/architecture/agent-runs/harness-contract.md`
- `almanac/architecture/agent-runs/provider-adapters.md`
- Yoke `docs/plans/2026-07-11-opencode-provider.md` and its capability table
- The original `8a39086e` diff on `feat/opencode-harness` (config/setup-wizard
  files only — not the deleted harness execution files) for the exact
  generalization being reapplied

# Fixes — OpenCode Harness Slice 2 Review

Review pass against `docs/plans/2026-07-08-opencode-harness-slice-2.md`. Findings below, most severe first, each with what was done.

## 🟡 Fix — `HARNESS_ORDER`/`TARGET_ORDER` re-duplicated the enum they should derive from

**Finding:** ironic given the slice's own stated goal — `HARNESS_ORDER`/`TARGET_ORDER` in `options.py` were hand-listed tuples of enum members (`(HarnessKind.CODEX, HarnessKind.CLAUDE, HarnessKind.OPENCODE)`), the exact "second hardcoded copy of the enum order" bug class this slice found and fixed once already in `cli/parser/setup.py`. `tuple(HarnessKind)` and `tuple(SetupTarget)` already equal these tuples exactly (enum declaration order matches), and the codebase already uses that idiom elsewhere (`cli/parser/setup.py`'s own `RUNNER_CHOICES`, `cli/parser/run_commands.py`, `services/config/service.py`).

**Fix:** `HARNESS_ORDER = tuple(HarnessKind)`, `TARGET_ORDER = tuple(SetupTarget)` — derived, not re-listed. Removes the drift risk entirely rather than leaving it "currently correct by coincidence."

## 🔵 Polish — `TARGET_SHORTCUTS`/`RUNNER_SHORTCUTS` were byte-identical dicts

**Finding:** `SetupTarget` and `HarnessKind` share the same string values (`"codex"`/`"claude"`/`"opencode"`), so the two shortcut dicts held identical mappings keyed by two structurally-identical-but-distinct enums — two places that must always be edited in lockstep.

**Fix:** collapsed to one `SHORTCUTS: dict[str, tuple[str, ...]]` keyed by `.value`, used via `SHORTCUTS[target.value]`/`SHORTCUTS[kind.value]` at both call sites.

## 🟡 Fix — README setup docs never mentioned OpenCode

**Finding:** `## Setup` and `## Providers` sections documented `--target codex`/`--target claude`/`--runner claude` with no OpenCode mention, despite this slice changing `codealmanac setup`'s actual default behavior (bare `setup --yes` now installs instructions for three targets, not two). Not scoped by any plan doc — a genuine gap between what shipped and what's documented.

**Fix:** added `--target opencode`/`--runner opencode` examples and `opencode auth login` to `## Providers`' credential list; noted the three-target default explicitly. Verified against `tests/test_public_contract.py::test_readme_documents_python_local_public_surface` (README fragment contract test) — still passes.

## 🔵 Polish — architecture test didn't assert `instructions.py` actually wires in OpenCode

**Finding:** `test_setup_instruction_adapter_stays_split_by_target_family` asserted `install_codex_instructions`/`install_claude_instructions` substrings and Codex/Claude-specific negative assertions, but never checked `opencode.py`'s presence/shape or that `instructions.py` actually references `install_opencode_instructions` — the test could pass even if OpenCode wiring were silently dropped.

**Fix:** added `opencode.py` to the required-files set, `install_opencode_instructions` to the `instructions.py` positive assertions, and negative assertions on `opencode.py` itself (no `AGENTS.override.md`, no `CLAUDE_IMPORT_LINE` — confirms it doesn't quietly grow a sibling's provider-specific machinery instead of staying its own thing).

## Non-findings confirmed by the reviewer (no action needed)

- `cli/parser/setup.py`'s fix (deriving `SETUP_TARGETS`/`RUNNER_CHOICES` from the enums) is correct and complete — no third raw-string literal found elsewhere.
- `target_options()`'s "all + N only" index math is internally consistent with `targets_for_index`/`target_default_index`.
- `DEFAULT_SETUP_TARGETS`'s 2→3 target change has no stale call site — `uninstall()`, `cli/render/setup/result.py`, `services/setup/planning.py` all render off the actual targets tuple dynamically.
- `opencode.py` faithfully mirrors `codex.py`'s installer shape (same shared `managed_blocks.py`/`text_files.py` helpers) for idempotent re-install, corrupted-block recovery, and never-installed uninstall — the deliberate omission of Codex's `AGENTS.override.md` convention is justified, not a partial mirror.

## Verification

- `uv run ruff check .` — clean.
- `uv run pytest -q` — 452 passed (unchanged count; this pass edited existing assertions/docs rather than adding new tests).

## Next steps

Move to Slice 3 (`sync` transcript discovery/reading) — write `docs/plans/2026-07-08-opencode-harness-slice-3.md` next.

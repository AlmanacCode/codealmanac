# OpenCode Harness — Slice 2: Setup Wizard + Onboarding

Slice 2 of 3 for `docs/plans/2026-07-07-opencode-harness.md` (tracks issue #9). Builds on Slice 1 (`HarnessKind.OPENCODE` registered, `OpencodeHarnessAdapter` runnable) — this slice makes OpenCode selectable in the setup wizard/CLI flags and installs its `AGENTS.md`-equivalent instructions file. Slice 3 (`sync` transcript discovery) is still out of scope.

Lower-risk than Slice 1: no live spiking needed here — this is generalizing existing binary Codex/Claude logic that already sits behind a clean `HarnessKind`-keyed seam (`HARNESS_MODELS`, `DEFAULT_HARNESS_MODELS` are already dicts, not if/else). One inherited caveat carries over from Slice 1's "Windows compatibility" section: the `~/.config/opencode/` directory itself is confirmed live (server startup logs showed `opencode serve` loading `~/.config/opencode/config.json` etc. during the Slice 1 spike, on macOS) but the specific `AGENTS.md` filename/precedence *within* that directory was not independently verified by a live spike — it's sourced from the master plan's citation of upstream issue opencode#22020, not tested here. Same graceful-degrade posture as Slice 1: if wrong, the managed-block writer creates the file at the (possibly wrong) path without crashing; it just wouldn't be read by OpenCode. Not re-verifying this in Slice 2 — flagging it for whoever eventually does the Windows verification pass Slice 1 deferred.

## Read before coding

1. `docs/plans/2026-07-07-opencode-harness.md` — "Design decisions" (AGENTS.md path rationale) and "Windows compatibility"
2. `src/codealmanac/cli/dispatch/setup_wizard/options.py` — the binary logic to generalize (`runner_options`, `runner_for_index`, `runner_index`, `target_options`, `targets_for_index`, `target_default_index`, `parse_setup_targets`, plus the `MODEL_LABELS`/`RUNNER_LABELS`/`MODEL_DETAILS` dicts)
3. `src/codealmanac/integrations/setup/codex.py` — the installer this slice's `opencode.py` mirrors (simpler than Claude's, since OpenCode doesn't need Claude's import-line/fallback pattern)
4. `src/codealmanac/integrations/setup/instructions.py` — thin dispatcher, **must stay ≤ 80 lines and avoid direct file I/O** (enforced by `tests/test_architecture.py::test_setup_instruction_adapter_stays_split_by_target_family` — read this test before editing the file)
5. `src/codealmanac/services/setup/models.py` / `requests.py` — `SetupTarget`, `DEFAULT_SETUP_TARGETS`
6. `src/codealmanac/cli/render/brand.py` — `BRAND_COLORS` (cosmetic, degrades gracefully without an entry)

## Scope

### Generalize `cli/dispatch/setup_wizard/options.py`

Currently every one of these branches on a literal `index == 1` or `harness == HarnessKind.CLAUDE`:

- `target_options()` — hardcoded `("Codex + Claude", "Codex only", "Claude only")` triplet
- `runner_options()` — two explicit `runner_option(...)` calls
- `target_default_index()` / `targets_for_index()` — `if targets == (SetupTarget.CODEX,): return 1` / `if index == 1: return (SetupTarget.CODEX,)`
- `runner_for_index()` / `runner_index()` — `if index == 1 → CLAUDE else → CODEX`
- `parse_setup_targets()` — `"all" → (SetupTarget.CODEX, SetupTarget.CLAUDE)`, hardcoded, separate from the wizard screens (easy to miss — flagged in the master plan's review findings)

Replace with one ordered tuple each harness/target derives its index from by position, so a 4th harness is a one-line addition, not a new branch:

```python
HARNESS_ORDER: tuple[HarnessKind, ...] = (
    HarnessKind.CODEX,
    HarnessKind.CLAUDE,
    HarnessKind.OPENCODE,
)
TARGET_ORDER: tuple[SetupTarget, ...] = (
    SetupTarget.CODEX,
    SetupTarget.CLAUDE,
    SetupTarget.OPENCODE,
)
```

- `runner_options()`: `tuple(runner_option(kind, by_kind.get(kind), SHORTCUTS[kind]) for kind in HARNESS_ORDER)`.
- `runner_for_index(index)` / `runner_index(harness)`: `HARNESS_ORDER[index]` / `HARNESS_ORDER.index(harness)`, falling back to index 0 / `HARNESS_ORDER[0]` on out-of-range the same way the current code silently falls back to Codex (preserve that behavior, don't raise).
- `target_options()`: generate the "all combinations" and "N only" choices from `TARGET_ORDER` rather than a hand-written triplet. **Design call:** the current wizard only ever offers a *combined* "Codex + Claude" option plus two "only" options — with three targets, "all combinations" would explode (7 non-empty subsets of 3 targets). Don't build a combinatorial picker; keep the wizard's existing shape of "everything" + "N only" per target: `("Codex + Claude + OpenCode", "Codex only", "Claude only", "OpenCode only")`. This is a deliberate, disclosed simplification, not a full generalization — revisit only if a future harness makes "everything" stop being the obviously-right bundled default.
- `targets_for_index()` / `target_default_index()`: index 0 → `TARGET_ORDER` (all), index N → `(TARGET_ORDER[N-1],)` for N in 1..len(TARGET_ORDER).
- `parse_setup_targets()`: `"all"` → `TARGET_ORDER` (now includes OpenCode) instead of the hardcoded two-tuple.
- `MODEL_LABELS`/`MODEL_DETAILS`: add entries for all three `HARNESS_MODELS[HarnessKind.OPENCODE]` model strings (`opencode/deepseek-v4-flash-free`, `opencode/mimo-v2.5-free`, `opencode/big-pickle` — see Slice 1's fixes doc for the confirmed-vs-run-to-completion distinction on these three).
- `RUNNER_LABELS`: add `HarnessKind.OPENCODE: "OpenCode"`.

### `integrations/setup/opencode.py` (new)

Mirrors `codex.py`, not `claude.py` — OpenCode gets its own explicit file, not an import-line-into-another-file pattern:

```python
def install_opencode_instructions(home: Path, guide: str) -> InstructionChange: ...
def uninstall_opencode_instructions(home: Path) -> InstructionChange: ...
```

Writes a managed block to `home / ".config" / "opencode" / "AGENTS.md"` (confirmed directory location; see the caveat at the top of this doc for the "AGENTS.md" filename specifically). No override-path resolution like Codex's `resolve_codex_agents_path()` — that's specific to Codex's own `AGENTS.override.md` convention, not something OpenCode has (nothing in the master plan's research suggested an OpenCode equivalent; don't invent one).

### `integrations/setup/instructions.py`

Add one import and one branch each to `install_target`/`uninstall_target`:

```python
if target == SetupTarget.OPENCODE:
    return opencode.install_opencode_instructions(home, guide)
```

Must stay ≤ 80 lines and must not gain direct file I/O (`write_text`/`read_text`/`unlink(`) — those stay in `opencode.py`, matching the architecture test's constraint on this file.

### `services/setup/models.py` / `requests.py`

- `SetupTarget.OPENCODE = "opencode"`.
- `DEFAULT_SETUP_TARGETS = (SetupTarget.CODEX, SetupTarget.CLAUDE, SetupTarget.OPENCODE)` — plain `codealmanac setup` with no `--target` flag installs all three, same tier as the existing two.

### `cli/render/brand.py` (cosmetic, consider not must-fix)

Add `"OpenCode": <a distinct 256-color code>` to `BRAND_COLORS`. Degrades gracefully without it (`label_word()` falls back to plain styling), but cheap to add while already touching wizard labels.

## Out of scope

- `sync` transcript discovery — Slice 3.
- A combinatorial target picker (all 7 subsets of 3 targets) — see the `target_options()` design call above.
- Re-verifying the `AGENTS.md` path/precedence on Windows — deferred to the Slice 1 Windows verification pass.

## File changes

| File | Change |
|---|---|
| `src/codealmanac/cli/dispatch/setup_wizard/options.py` | `HARNESS_ORDER`/`TARGET_ORDER`-driven `runner_options`, `runner_for_index`, `runner_index`, `target_options`, `targets_for_index`, `target_default_index`, `parse_setup_targets`; add OpenCode entries to `MODEL_LABELS`/`MODEL_DETAILS`/`RUNNER_LABELS` |
| `src/codealmanac/services/setup/models.py` | add `SetupTarget.OPENCODE` |
| `src/codealmanac/services/setup/requests.py` | add `SetupTarget.OPENCODE` to `DEFAULT_SETUP_TARGETS` |
| `src/codealmanac/integrations/setup/opencode.py` | new — `install_opencode_instructions`/`uninstall_opencode_instructions` |
| `src/codealmanac/integrations/setup/instructions.py` | add `SetupTarget.OPENCODE` branch (stay ≤ 80 lines, no direct file I/O) |
| `src/codealmanac/cli/render/brand.py` | add `"OpenCode"` to `BRAND_COLORS` |
| `src/codealmanac/cli/parser/setup.py` | **found during implementation, not in original scope** — `SETUP_TARGETS = ("all", "codex", "claude")` and `--runner` `choices=("codex", "claude")` are a *second*, independent set of hardcoded string literals gating argparse itself, missed by the initial grep for `SetupTarget.CODEX`/`HarnessKind.CODEX` (this file uses raw strings, not the enum members). Without this fix, `codealmanac setup --target opencode`/`--runner opencode` would be rejected by argparse before ever reaching any of the code this slice otherwise generalized. Fixed by deriving both tuples from `SetupTarget`/`HarnessKind` directly instead of a second hardcoded copy. |
| `tests/test_setup_wizard_options.py` (new) | `HARNESS_ORDER`/`TARGET_ORDER` generalization coverage, `install_opencode_instructions`/`uninstall_opencode_instructions`, `FileInstructionInstaller` with `SetupTarget.OPENCODE` |

## Test coverage

- `runner_for_index`/`runner_index` round-trip for all three harnesses, including out-of-range index falling back to `HARNESS_ORDER[0]` (Codex) — preserves existing silent-fallback behavior.
- `target_options()` returns four options (all + one per target) with OpenCode included.
- `targets_for_index`/`target_default_index` round-trip for all four wizard positions.
- `parse_setup_targets("all")` returns all three targets; `parse_setup_targets("opencode")` returns `(SetupTarget.OPENCODE,)`.
- `install_opencode_instructions`/`uninstall_opencode_instructions`: fresh install, idempotent re-install (no change), uninstall removes the managed block, uninstall of a never-installed target is a no-op — mirrors whatever `test_cli.py`/existing coverage does for `install_codex_instructions`.
- `FileInstructionInstaller.install/uninstall` with `SetupTarget.OPENCODE` in the targets tuple.
- Architecture test (`test_setup_instruction_adapter_stays_split_by_target_family`) still passes unmodified — confirms `instructions.py` didn't grow file I/O or blow the line budget.

## Next steps after this slice

1. Build against this doc.
2. Review pass → `docs/plans/fixes-opencode-harness-slice-2-review.md`, own commit (per user: nothing committed until the full three-slice implementation is done, but the fixes still land as their own logical change).
3. Move to Slice 3 (`sync` transcript discovery/reading).

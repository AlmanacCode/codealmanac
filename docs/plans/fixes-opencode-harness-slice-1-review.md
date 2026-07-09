# Fixes — OpenCode Harness Slice 1 Review

Review pass against `docs/plans/2026-07-08-opencode-harness-slice-1.md` (per `.claude/agents/review.md`, `MANUAL.md` §6 slice discipline). Findings below, most severe first, each with what was done.

## 🔴 Bug — `check_providers` didn't catch `ValueError` the way `run()` does

**Finding:** `OpencodeClient.run()` catches `FileNotFoundError` / `OpencodeServerStartupError` / `httpx.HTTPError` / `ValueError` around `run_once`, because `response.json()` (called by `get_providers`/`create_session`/`post_message`) raises `json.JSONDecodeError` — a `ValueError` subclass — on a malformed 200 response, not an `httpx.HTTPError`. `check_providers` calls the same `get_providers` but only caught `httpx.HTTPError`, so a malformed/non-JSON response from `opencode serve` would crash straight through `check_providers` uncaught. Since `HarnessesService.check()` iterates every adapter's `check()` with no per-adapter try/except, and interactive `codealmanac setup` calls it directly, this could take down the whole `setup` command instead of degrading OpenCode to "not available" the way every other error path in the file does.

**Fix:** added `except ValueError as error` to `check_providers` (`client.py`), mapped to the same `HarnessReadiness(available=False, repair=OPENCODE_SERVER_REPAIR)` shape as the `httpx.HTTPError` branch. Added `test_opencode_client_check_providers_reports_not_ready_on_malformed_json` to guard the regression.

## 🟡 Fix — dead `agent_parents`/`agent_labels` fields on `OpencodeRunState`

**Finding:** copied from `CodexRunState`/`ClaudeRunState`'s shape, but nothing in the OpenCode package ever writes or reads them — sub-agent session-tree traversal isn't implemented in this slice (already disclosed in the slice-1 plan's "Out of scope"). Left in place, they read as a half-finished wire-up rather than an intentional placeholder.

**Fix:** removed both fields from `state.py`, replaced with a comment pointing at the "Out of scope" entry, noting they should come back alongside whatever code actually populates them.

## 🟡 Fix — two of three curated OpenCode model strings lacked a documented evidence trail

**Finding:** `opencode/deepseek-v4-flash-free` was the only model run through a full end-to-end generation during the spike. `opencode/mimo-v2.5-free` and `opencode/big-pickle` don't appear in the spike findings doc or any test, so a reader can't tell whether they're verified or invented.

**Resolution (not a removal — the evidence exists, it just wasn't recorded):** all three model IDs *are* real — confirmed present in a live `GET /config/providers` response for the `opencode` (Zen, free-tier) provider during the 2026-07-08 spike, captured earlier in that session but not carried into the plan docs or code. Added a comment on `HARNESS_MODELS[HarnessKind.OPENCODE]`/`DEFAULT_HARNESS_MODELS[HarnessKind.OPENCODE]` in `services/config/models.py` distinguishing the two confirmation tiers: registered-and-listed (all three) vs. actually-run-to-completion (`deepseek-v4-flash-free` only) — and noting the default should only ever be the fully-verified one. No code behavior changed; this closes the "undocumented evidence trail" gap the review actually flagged.

## 🔵 Polish — near-duplicate exception handling between `check_providers` and `run()`

**Finding:** once the 🔴 fix above landed, the two methods' except-chains are nearly identical (same exception types, different return shape) — noted as the kind of duplication that caused the 🔴 bug in the first place (fixed in one branch, not the sibling).

**Resolution:** did not extract a shared helper — the two `ValueError` sources mean genuinely different things (`check_providers`'s is a malformed server response; `run()`'s is a bad `model` string from `split_opencode_model`, happening before any server call), so a fully shared mapper would need call-site context to pick the right repair text, which isn't a clear win for two call sites. Instead added a short cross-reference comment on each except-chain pointing at its sibling, so the next person editing one notices the other.

## Verification

- `uv run ruff check .` — clean.
- `uv run pytest -q` — 433 passed (432 pre-review + 1 new regression test for the fixed `ValueError` path).

## Next steps

Move to Slice 2 (setup wizard generalization) — write `docs/plans/2026-07-08-opencode-harness-slice-2.md` next.

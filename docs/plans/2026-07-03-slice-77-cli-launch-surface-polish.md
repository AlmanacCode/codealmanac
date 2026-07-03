# Slice 77 CLI Launch Surface Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the public `codealmanac` CLI match the launch contract: cloud-first help, agent-safe setup browser behavior, OpenAlmanac-style setup output, and hidden stale local-first compatibility commands.

**Architecture:** Keep CLI parsing, dispatch, terminal interaction, and rendering in their existing owned modules. The CLI remains a thin adapter over services/workflows; this slice changes command presentation and setup edge behavior without moving product decisions into the parser.

**Tech Stack:** Python 3.12, argparse, Rich for existing console plumbing, Pydantic request/result models, pytest, ruff, PyPI trusted publishing.

---

## Read Before Coding

- `MANUAL.md`
- `.almanac/README.md`
- `docs/python-port-live-agreement.md`
- `docs/codealmanac-launch/cli-contract.md`
- `docs/codealmanac-launch/open-questions.md`
- `docs/reference/cosmic-python/chapter_04_service_layer.md`
- `docs/reference/cosmic-python/chapter_10_commands.md`
- `/Users/rohan/Desktop/Projects/openalmanac/mcp/src/setup/tui.ts`

## Current Evidence

- `codealmanac --help` still says `Maintain a local Almanac wiki for a codebase.`
- Root help lists cloud setup after local/read commands.
- Root help still exposes `sync` and top-level `jobs`, even though launch docs teach `local jobs` and do not teach root `sync`.
- `codealmanac setup --yes` maps to browser mode `open`; the launch contract says `--yes` must not silently open a browser in non-interactive/agent contexts.
- Setup output has the banner but does not reuse the OpenAlmanac next-steps box or exact ANSI color constants.

## Task 1: Lock Public Help Contract

**Files:**
- Modify: `src/codealmanac/cli/parser/root.py`
- Modify: `src/codealmanac/cli/parser/admin.py`
- Modify: `src/codealmanac/cli/parser/lifecycle.py`
- Modify: `src/codealmanac/cli/parser/jobs.py`
- Test: `tests/test_cli.py`

**Steps:**

1. Update the root parser description to a cloud-first launch description.
2. Reorder parser registration so cloud commands appear before local/wiki commands:
   `open`, `setup`, `login`, `whoami`, `logout`, `capture`, `repo`, `runs`, then local/wiki/admin tools.
3. Hide root `sync` with `help=argparse.SUPPRESS` while keeping parser/dispatch compatibility.
4. Hide root `jobs` with `help=argparse.SUPPRESS` while keeping parser/dispatch compatibility.
5. Keep `automation` visible for now because public docs still mention it as an explicit local scheduling surface.
6. Update `test_cli_help_includes_serve` into a cloud-first public-help test:
   - description includes cloud/repository wording
   - `setup` appears before `local`
   - `sync`, root `jobs`, `ingest`, `garden`, and `dev` do not appear
   - `automation` still appears
7. Add parser-compatibility assertions that `parser.parse_args(("sync", "status"))` and `parser.parse_args(("jobs",))` still parse.

**Expected tests:**

```bash
uv run pytest tests/test_cli.py::test_cli_help_includes_serve -q
```

## Task 2: Make Setup Browser Mode Agent-Safe

**Files:**
- Modify: `src/codealmanac/cli/dispatch/setup.py`
- Test: `tests/test_cli.py`

**Steps:**

1. Change `setup_login_browser_mode` so `--yes` returns `prompt`, not `open`.
2. Keep `--no-browser` as `never` and `--json` as `silent`.
3. Rely on `TerminalCloudLoginInteraction` to open only when a TTY prompt can be answered yes.
4. Update `test_cli_setup_is_cloud_first_without_repo_detection` to assert that non-interactive `setup --yes` does not open the browser and still prints URL/code.

**Expected tests:**

```bash
uv run pytest tests/test_cli.py::test_cli_setup_is_cloud_first_without_repo_detection -q
```

## Task 3: Reuse OpenAlmanac Setup TUI Style

**Files:**
- Modify: `src/codealmanac/cli/render/setup.py`
- Test: `tests/test_cli.py`

**Steps:**

1. Replace Rich style names for the banner with explicit ANSI constants from OpenAlmanac:
   `RST`, `BOLD`, `DIM`, `WHITE_BOLD`, `BLUE`, `BLUE_DIM`, `ACCENT`, `GRADIENT`.
2. Keep the hard-coded logo lines; do not add a figlet dependency.
3. Add setup rendering helpers equivalent to OpenAlmanac:
   - `visible_width`
   - `box_inner_width`
   - `box_row`
   - `render_next_steps_box`
   - `step_active`
   - `step_done`
4. Render setup and uninstall headings through the ANSI banner.
5. Render `Next steps` inside the OpenAlmanac-style box.
6. Preserve JSON output exactly.
7. Update setup CLI tests to assert:
   - output contains ANSI color escapes
   - output contains `Next steps`
   - output contains box corners
   - next commands still include `codealmanac capture enable` and `codealmanac repo setup`

**Expected tests:**

```bash
uv run pytest tests/test_cli.py::test_cli_setup_and_uninstall_codex_instructions -q
```

## Task 4: Version And Docs

**Files:**
- Modify: `pyproject.toml`
- Modify: `docs/codealmanac-launch/cli-contract.md`
- Modify: `docs/codealmanac-launch/open-questions.md`
- Modify: `docs/codealmanac-launch/worklog.md`
- Modify: `docs/codealmanac-launch/progress.md`
- Modify: `docs/codealmanac-launch/verification-matrix.md`
- Modify: `docs/codealmanac-launch/next-agent-brief.md`

**Steps:**

1. Bump package version from `0.1.6` to `0.1.7`.
2. Record Slice 77 in the launch worklog.
3. Update `cli-contract.md` with implemented behavior:
   - cloud-first help ordering
   - root `sync` and root `jobs` hidden from public help
   - `setup --yes` does not bypass the browser prompt logic in non-interactive runs
   - setup output uses the OpenAlmanac ANSI box style
4. Remove or narrow the open question about hidden compatibility commands if this slice answers it.
5. Update `progress.md` after verification. CLI/public UX stays high but should now be more honestly based on published `0.1.7`, not only `0.1.6`.
6. Update `verification-matrix.md` and `next-agent-brief.md` with exact local and publish evidence.

## Task 5: Verify, Publish, Smoke

**Commands:**

```bash
uv run pytest tests/test_cli.py tests/test_public_contract.py tests/test_cloud_login_workflow.py -q
uv run ruff check src/codealmanac/cli src/codealmanac/integrations/cloud_login.py tests/test_cli.py tests/test_public_contract.py tests/test_cloud_login_workflow.py
git diff --check
rm -rf dist
uv build --out-dir dist
uvx twine check dist/*
python -m venv /tmp/codealmanac-slice77-venv
/tmp/codealmanac-slice77-venv/bin/pip install dist/codealmanac-0.1.7-py3-none-any.whl
/tmp/codealmanac-slice77-venv/bin/codealmanac --help
/tmp/codealmanac-slice77-venv/bin/codealmanac setup --skip-login --skip-instructions --yes
```

**Git / deploy:**

1. Commit the verified slice.
2. Push to `origin/dev`.
3. Fast-forward or push to `origin/main`.
4. Trigger GitHub Actions `publish` with `confirm_version=0.1.7`.
5. Wait for publish success.
6. Install from PyPI into an isolated temp HOME with `uv tool install --python 3.12 --refresh --force codealmanac==0.1.7`.
7. Smoke:
   - `codealmanac --version`
   - `codealmanac --help`
   - `codealmanac setup --skip-login --skip-instructions --yes`
   - optional: `codealmanac login --force --no-browser` and Chrome `/cli-login` approval if time permits.

## RelayForge Update

Send one update after publish/live smoke with:

- What changed.
- Local verification.
- PyPI publish state.
- Chrome/CLI smoke state.
- Updated percentages.

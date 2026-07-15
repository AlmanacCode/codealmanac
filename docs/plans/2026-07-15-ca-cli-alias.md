# CA CLI Alias Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install `ca` as a short alias for the canonical `codealmanac` command.

**Architecture:** Keep one CLI implementation and expose it through two Python console-script names. Both entry points target `codealmanac.cli.main:main`, so parsing, dispatch, output, errors, and exit codes remain identical without adding alias-aware runtime branches.

**Tech Stack:** Python packaging (`pyproject.toml`), pytest, uv, Markdown public-contract documentation.

---

### Task 1: Change the package entry-point contract

**Files:**
- Modify: `tests/test_public_contract.py`
- Modify: `pyproject.toml`

**Step 1: Write the failing test**

Rename the entry-point contract test and require both names to target the same callable:

```python
def test_public_entry_points_include_ca_alias():
    pyproject = tomllib.loads((PROJECT_ROOT / "pyproject.toml").read_text())

    scripts = pyproject["project"]["scripts"]

    assert scripts == {
        "ca": "codealmanac.cli.main:main",
        "codealmanac": "codealmanac.cli.main:main",
    }
```

**Step 2: Run the test to verify it fails**

Run: `uv run pytest tests/test_public_contract.py::test_public_entry_points_include_ca_alias -q`

Expected: FAIL because `pyproject.toml` does not yet declare `ca`.

**Step 3: Add the minimal package entry point**

Add the second script in `pyproject.toml`:

```toml
[project.scripts]
ca = "codealmanac.cli.main:main"
codealmanac = "codealmanac.cli.main:main"
```

**Step 4: Run the focused test**

Run: `uv run pytest tests/test_public_contract.py::test_public_entry_points_include_ca_alias -q`

Expected: PASS.

### Task 2: Update the public contract documentation

**Files:**
- Modify: `README.md`
- Modify: `RELEASE.md`
- Modify: `almanac/reference/cli/public-command-surface.md`
- Modify: `almanac/guides/release-package.md`
- Modify: `tests/test_public_contract.py`

**Step 1: Document command identity**

Keep `codealmanac` canonical and describe `ca` as its short alias. Remove statements that the package exposes exactly one command or no compatibility aliases.

**Step 2: Guard the README contract**

Require the README fragment `Short alias: `ca`` in `README_REQUIRED_FRAGMENTS`.

**Step 3: Run the public-contract tests**

Run: `uv run pytest tests/test_public_contract.py -q`

Expected: PASS.

### Task 3: Verify the built artifacts

**Files:**
- Verify only: repository and temporary build/install directories

**Step 1: Run repository gates**

Run: `uv run pytest && uv run ruff check . && git diff --check`

Expected: all tests pass, Ruff reports no errors, and Git reports no whitespace errors.

**Step 2: Build and inspect artifacts**

Run: `uv build --out-dir <temporary-directory>`

Expected: wheel and source distribution build successfully.

**Step 3: Smoke both installed commands**

Install the wheel into a temporary virtual environment, then run:

```bash
codealmanac --version
ca --version
```

Expected: both commands exit zero and print the same CodeAlmanac version.

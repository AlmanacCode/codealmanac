# Next Agent Brief

Updated: 2026-06-29

## Current State

- Goal is active: rebuild CodeAlmanac from scratch as a Python codebase.
- Branch: `codex/python-port-archive-existing-code`.
- Archive/docs baseline committed as `4520812`.
- First Python scaffold committed as `a803f63`.
- `docs/python-port-live-agreement.md` is the live contract.
- `docs/reference/cosmic-python/` contains Markdown-only reference chapters.
- Steering docs live in `docs/python-port/`.
- Python code exists under `src/codealmanac/` with CLI, app composition,
  workspaces, wiki scaffold/build workflow, SQLite FTS5 read model, search,
  show, topics, health, tag/untag, topic mutation, build, reindex, doctor, and
  the first local `serve` viewer.
- `services/runs` owns the local run ledger under `.almanac/jobs/`; public
  inspection stays under `codealmanac jobs`.
- The index read model now uses stale-aware source signatures for ordinary
  `ensure_fresh`; `reindex` remains the explicit forced rebuild command.
- Current implemented CLI commands are `init`, `build`, `list`, `search`,
  `show`, `topics`, `health`, `reindex`, `doctor`, `jobs`, `serve`, `tag`, and
  `untag`.
- Topic metadata mutation now covers `topics create`, `topics describe`,
  `topics link`, `topics unlink`, `topics rename`, and `topics delete`.

## Last Good Evidence

- `MANUAL.md`, `CLAUDE.md`, `.almanac/README.md`, the live agreement, and the
  Cosmic Python guide were read on 2026-06-29.
- The relevant Cosmic Python pressure for the first slice is:
  - code under `src`
  - entrypoints thin
  - service-layer tests where possible
  - dependencies wired in one composition root
- First scaffold verification passed:
  - `uv run pytest`
  - `uv run ruff check .`
  - `uv run codealmanac --help`
  - isolated live `codealmanac init` and `codealmanac list`
- Slice-1 review fix hardened workspace registry temp writes and passed:
  - `uv run pytest`
  - `uv run ruff check .`
  - isolated live `codealmanac init` and `codealmanac list`
- Slice-2 read model passed:
  - `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run pytest`
  - `UV_CACHE_DIR=/private/tmp/usealmanac-uv-cache uv run ruff check .`
  - isolated live `search --mentions`, `show --backlinks`, `show --files`
  - dogfood `codealmanac search python --limit 5` in this repo
- Slice-2 review fix passed:
  - 14 tests
  - ruff
  - isolated live `show --body --meta`
  - dogfood `codealmanac search python --limit 3`
- Slice-3 topics/health passed:
  - 17 tests
  - ruff
  - isolated live `topics`, `topics show`, `health --json`
  - dogfood `topics` and `health` in this repo
- Slice-3 review fix passed:
  - 19 tests
  - ruff
  - isolated live path-safety `health --json`
  - dogfood `health`
- Slice-4 tag/untag passed:
  - 24 tests
  - ruff
  - isolated live `tag`, `show --topics`, `untag`, `show --topics`
  - CLI `--help` includes `tag` and `untag`
- Slice-4 review fix passed:
  - 25 tests
  - ruff
  - live EOF-frontmatter and no-op untag smoke
- Slice-5 topic metadata mutation passed:
  - 32 tests
  - ruff
  - `git diff --check`
  - isolated live `topics create`, `topics describe`, `topics link`,
    `topics unlink`, and `topics show`
  - CLI `topics --help`
  - dogfood `topics show cli --descendants` in this repo
- Slice-6 topic rewrite mutation passed:
  - 39 tests
  - ruff
  - `git diff --check`
  - isolated live `topics rename`, `topics show`, `topics delete`,
    `topics show`, and page inspection
  - CLI `topics --help`
  - dogfood `topics show cli --descendants` in this repo
- Slice-7 build/reindex passed:
  - 42 tests
  - ruff
  - `git diff --check`
  - isolated live `build`, `reindex`, `search`, and `--help`
  - top-level CLI `--help` includes `build` and `reindex`
- Slice-8 doctor passed:
  - 46 tests
  - ruff
  - `git diff --check`
  - isolated live no-wiki and built-wiki `doctor`
  - dogfood `codealmanac doctor`
  - dogfood `codealmanac doctor --json`
  - top-level CLI `--help` includes `doctor`
- Slice-9 serve passed:
  - 53 tests
  - ruff
  - `git diff --check`
  - live `codealmanac serve --port 49217`
  - live API overview/search/page checks in this repo
  - top-level CLI `--help` and `serve --help`
  - `uv build --out-dir /tmp/codealmanac-build` and wheel asset inspection
  - Browser-harness did not attach because Chrome requires the manual
    remote-debugging permission click.
- Slice-9 review fix passed:
  - 55 tests
  - ruff
  - focused read-model/viewer/server tests
  - live `codealmanac serve --port 49219`
  - live API overview/search/page/app.js checks in this repo
  - SQLite trigger check showing warm read traffic did not rewrite `pages`
- Slice-10 runs ledger focused checks passed:
  - focused runs service and jobs CLI tests
  - 59 full tests
  - ruff
  - `git diff --check`
  - isolated live jobs CLI dogfood

## Dirty/Staged Files

After slice 10 is committed, the worktree should be clean. If any slice-10 files
are dirty, re-run focused runs tests, `git diff --check`, pytest, ruff, and live
jobs CLI dogfood.

## Next Move

1. Decide whether the next lifecycle slice should add source input contracts or
   foreground/background run execution.
2. Decide whether the viewer needs source/file route hardening before AI-backed
   lifecycle commands.
3. Keep AI execution behind workflow and harness seams; do not put it in CLI.
4. Add an architecture test that CLI imports do not import concrete integration
   modules once integrations exist.

## Things Not To Do

- Do not resurrect public `almanac`, `alm`, `absorb`, or `capture` commands.
- Do not make CLI commands the internal API.
- Do not pull hosted product assumptions into local v1.
- Do not copy the TypeScript structure just because it exists in `archive/code/`.

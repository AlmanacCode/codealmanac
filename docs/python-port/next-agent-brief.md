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
  show, topics, health, tag/untag, topic mutation, build, reindex, and doctor.
- Current implemented CLI commands are `init`, `build`, `list`, `search`,
  `show`, `topics`, `health`, `reindex`, `doctor`, `tag`, and `untag`.
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

## Dirty/Staged Files

After slice 8 is committed, the worktree should be clean. If any slice-8 files
are dirty, re-run `git diff --check`, pytest, ruff, and an isolated
doctor live smoke before committing further work.

## Next Move

1. Review slice-8 doctor before broader lifecycle work.
2. Decide the first `serve` slice shape and framework/library choice.
3. Keep lifecycle/AI commands out until local maintenance surfaces hold.
4. Add an architecture test that CLI imports do not import concrete integration
   modules once integrations exist.

## Things Not To Do

- Do not resurrect public `almanac`, `alm`, `absorb`, or `capture` commands.
- Do not make CLI commands the internal API.
- Do not pull hosted product assumptions into local v1.
- Do not copy the TypeScript structure just because it exists in `archive/code/`.

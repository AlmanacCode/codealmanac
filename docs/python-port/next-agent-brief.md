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
- First Python scaffold exists under `src/codealmanac/` with CLI, app,
  workspaces, wiki scaffold, and build workflow.
- Slice-2 read-model work exists with `search` and `show`, SQLite FTS5 index,
  wiki parser/link classifier, and service-layer tests.

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

## Dirty/Staged Files

At this checkpoint, only the slice-2 review fix should be dirty until
committed. Re-run `git diff --check`, pytest, ruff, isolated live smoke, and
dogfood search before committing.

## Next Move

1. Review slice-2 boundaries before adding lifecycle commands.
2. Decide whether to optimize index freshness now or defer until after
   `topics`/`health`; current read model rebuilds on every read command.
3. Add `topics`/`health` on top of the existing index if the read model review
   holds.
4. Add an architecture test that CLI imports do not import concrete integration
   modules once integrations exist.

## Things Not To Do

- Do not resurrect public `almanac`, `alm`, `absorb`, or `capture` commands.
- Do not make CLI commands the internal API.
- Do not pull hosted product assumptions into local v1.
- Do not copy the TypeScript structure just because it exists in `archive/code/`.

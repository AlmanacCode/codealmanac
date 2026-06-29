# Slice 41 - Configurable Almanac Root

Date: 2026-06-29

## Product Decision

Python CodeAlmanac is for new users. Repo wiki state no longer defaults to
`.almanac/`.

New repos default to `almanac/`. Users can choose another repo-relative root
with `codealmanac init --root <path>` or `codealmanac build --root <path>`.
Supported examples include `docs/almanac/` and explicit `.almanac/`. Once a
repo is registered, running `init` or `build` without `--root` preserves the
registered root.

The configured root owns both committed wiki files and local runtime artifacts:
`README.md`, `pages/`, `topics.yaml`, `manual/`, `config.toml`, `index.db`,
and `jobs/`.

## Architecture

`services/workspaces` owns the root setting.

```python
InitializeWorkspaceRequest(almanac_root=Path("docs/almanac"))
  -> WorkspacesService.register(...)
  -> Workspace(almanac_root=Path("docs/almanac"),
               almanac_path=repo / "docs/almanac")
  -> downstream services use workspace.almanac_path
```

The registry stores `almanac_root` as a repo-relative path. `Workspace` still
exposes `almanac_path` because downstream services need the concrete absolute
directory.

`core/paths.py` no longer owns nearest wiki discovery. Root discovery lives in
`services/workspaces/roots.py`.

## Implementation Notes

- CLI setup gained optional `--root` on `init` and `build`.
- `codealmanac list` prints `name`, repo path, and configured root.
- `WikiService` scaffolds files under `workspace.almanac_path`.
- `.gitignore` entries are rendered from `workspace.almanac_root`.
- Project config discovery now resolves the workspace first and reads
  `<almanac-root>/config.toml`.
- Run log references now use `<almanac-root>/jobs/<run>.jsonl`.
- Transcript candidates carry both `repo_root` and `almanac_path`.
- Sync ledger reads/writes use `candidate.almanac_path`.
- Index health receives the true repo root from `IndexService`; it no longer
  assumes `almanac_path.parent` is the repo root.
- Lifecycle safety messages use the configured root path instead of `.almanac`.
- Prompts and manual docs now say "configured Almanac root" instead of naming
  `.almanac/`.

## Tests

Added or updated coverage for:

- default `almanac/` initialization
- `docs/almanac/` initialization
- explicit `.almanac/` initialization
- CLI `init --root docs/almanac`
- registry-backed workspace resolution for configured roots
- plain `build` preserving an already registered configured root
- transcript discovery with configured roots
- sync passing registered roots into transcript discovery
- run log paths under the configured root
- project config under the configured root
- source-directory ignores for `almanac/` and `docs/almanac/`
- architecture guard that root discovery is workspace-owned

## Follow-up Landed In Slice 42

Slice 42 removed the common-root shortcut. Ingest now passes the configured
`workspace.almanac_root` into source runtime through `SourceRuntimeContext`, and
filesystem runtime applies that context for both Git listing and Python walking.

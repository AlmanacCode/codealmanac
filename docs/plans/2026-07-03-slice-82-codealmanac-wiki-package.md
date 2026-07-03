# Slice 82: CodeAlmanac wiki package boundary

## Goal

Move CodeAlmanac's repo-wiki and read-model code into a first-class
`codealmanac.wiki` package.

This follows Slice 81's `codealmanac.cloud` package boundary. The code should
now read closer to the product model:

```text
codealmanac.cloud   # local client surface for CodeAlmanac Cloud
codealmanac.wiki    # repo wiki, registry, index, search, pages, topics, health, viewer
```

## Scope

Move these packages:

```text
services/wiki       -> wiki/
services/workspaces -> wiki/workspaces/
services/index      -> wiki/index/
services/search     -> wiki/search/
services/pages      -> wiki/pages/
services/topics     -> wiki/topics/
services/health     -> wiki/health/
services/viewer     -> wiki/viewer/
```

Update all imports in `src/`, `tests/`, and current docs that describe the
active architecture.

Add architecture coverage so old tracked source modules do not return under
`services/`.

## Out Of Scope

- Do not change CLI command names or output.
- Do not rename classes yet. `IndexService`, `WorkspaceRegistryStore`,
  `WikiService`, etc. stay stable in this slice.
- Do not change database schemas or file formats.
- Do not move local runs/control/automation code yet.
- Do not move engine/prompt/source-bundle/harness code yet.

## Design Decisions

- `codealmanac.wiki` is broader than markdown parsing. It owns the user's
  repo-wiki boundary: registry/workspace selection, wiki files, index DB,
  search/read commands, page/topic health, and the local viewer.
- `codealmanac.services` should keep generic product services for areas not yet
  repackaged. After this slice, wiki/read modules should not live there.
- Existing integrations that need workspace or wiki models should import the
  new package directly. This is not a layering violation; the package is the
  service boundary.
- Keep the composition root in `src/codealmanac/app.py`; it wires the moved
  services exactly as before.

## Read Before Coding

- `MANUAL.md`
- `.almanac/README.md`
- `docs/refactor-audit-2026-07-03-hosted-local-architecture/target-architecture.md`
- `docs/reference/cosmic-python/chapter_04_service_layer.md`
- `docs/reference/cosmic-python/chapter_13_dependency_injection.md`

Relevant Cosmic Python transfer:

- service layer separates orchestration from entrypoints;
- composition root wires dependencies in one place.

## Implementation Steps

1. Create `src/codealmanac/wiki/` subpackages.
2. `git mv` the scoped packages.
3. Rewrite imports from `codealmanac.services.<wiki area>` to
   `codealmanac.wiki.<area>`.
4. Update architecture tests and active docs.
5. Run focused tests for wiki/index/search/topics/viewer/workspaces.
6. Run full `uv run ruff check src tests` and `uv run pytest -q --tb=short`.

## Verification

Focused:

```bash
uv run pytest \
  tests/test_read_model.py \
  tests/test_wiki_parsing.py \
  tests/test_topics_health.py \
  tests/test_topics_mutation.py \
  tests/test_viewer_renderer.py \
  tests/test_viewer_service.py \
  tests/test_workspace_registry_store.py \
  tests/test_git_workspace_probe.py \
  tests/test_build_workflow.py \
  tests/test_init_workflow.py \
  tests/test_cli.py \
  tests/test_architecture.py \
  -q --tb=short
```

Full:

```bash
uv run ruff check src tests
uv run pytest -q --tb=short
git diff --check
```

## Expected Risk

High import churn, low behavior risk. The main failure mode is a stale import or
an architecture test still asserting the old path.

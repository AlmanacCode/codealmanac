# CodeAlmanac Rebuild Tickets

These tickets rebuild the local Python product around the new decisions in
`notes.md`. They are ordered. Do not skip ahead: later tickets depend on the
data model, paths, and command contracts from earlier tickets.

## Ticket 1: Lock The Product Contract

Goal: make the public contract unambiguous before changing internals.

Todos:

- Update product docs to say the only repo wiki root is `almanac/`.
- Remove `docs/almanac/`, `.almanac/`, custom root, hosted, and compatibility language.
- Document the existing `.almanac/` directory as legacy repo memory to migrate,
  not as a supported root.
- Keep the public CLI name as `codealmanac`.
- Remove `almanac` and `alm` aliases if any exist.
- Update README, AGENTS.md, MANUAL.md, and `docs/python-port-live-agreement.md`.
- Update public contract tests to assert the new contract.

Verification:

- `uv run pytest tests/test_public_contract.py`
- `uv run ruff check src/codealmanac/cli/parser/lifecycle.py src/codealmanac/cli/dispatch/build.py src/codealmanac/services/workspaces/roots.py src/codealmanac/services/workspaces/service.py tests/test_public_contract.py`
- Focused text scan: active public docs must not advertise alternate roots,
  `--root`, old command aliases, old page layout, wikilinks, or `files:`.
  Mentions of `.almanac/` are allowed only when explicitly labeled legacy
  migration input.

## Ticket 2: Replace `pages/` With A Nested `almanac/` Tree

Goal: make the committed wiki a browsable documentation tree.

Todos:

- Remove the `almanac/pages/` storage assumption.
- Treat every markdown file under `almanac/` as a page, except reserved files.
- Support nested folders at any depth.
- Use the page path under `almanac/` as the page id.
- Map page ids like `architecture/viewer/navigation/sidebar` to files like
  `almanac/architecture/viewer/navigation/sidebar.md`.
- Define README route behavior:
  - `almanac/README.md` -> `README`
  - `almanac/architecture/README.md` -> `architecture`
- Reject route collisions such as:
  - `almanac/architecture.md`
  - `almanac/architecture/README.md`
- Remove `slug:` as a required or meaningful page identity field.

Files:

- `src/codealmanac/services/wiki/documents.py`
- `src/codealmanac/services/wiki/frontmatter.py`
- `src/codealmanac/services/wiki/paths.py`
- `src/codealmanac/services/index/`
- `src/codealmanac/services/pages/`
- `tests/test_wiki_parsing.py`
- `tests/test_read_model.py`
- `tests/test_cli.py`

Verification:

- Add tests for nested pages.
- Add tests for README route mapping.
- Add tests for route collision failures.
- `uv run pytest tests/test_wiki_parsing.py tests/test_read_model.py tests/test_cli.py`

## Ticket 2.5: Migrate This Repo's Legacy `.almanac/`

Goal: carry forward useful project memory without preserving the old product
model.

Todos:

- Read `.almanac/README.md`, `.almanac/topics.yaml`, and `.almanac/pages/*.md`.
- Keep facts that still apply to the local-first Python product.
- Drop hosted/cloud assumptions, old root rules, old `pages/` layout rules,
  wikilink guidance, `files:` compatibility, and old command names.
- Rewrite surviving pages into the new nested `almanac/` tree.
- Use Markdown links and `sources:` in the new page format.
- Remove `.almanac/` from active product docs after migration.

Verification:

- `codealmanac validate`
- `rg "\\.almanac|\\[\\[|files:" almanac README.md AGENTS.md MANUAL.md docs src tests`

## Ticket 3: Remove `files:` And Make `sources:` Canonical

Goal: use one evidence model.

Todos:

- Remove `files:` support from new page parsing.
- Remove docs that mention `files:` as a supported page field.
- Represent file evidence only through `sources:` entries with `type: file`.
- Derive `search --mentions` data from `sources[type=file]`.
- Validate source entries have `id`, `type`, and the required target field.
- Update tests that currently rely on `files:`.

Example:

```yaml
sources:
  - id: viewer-main
    type: file
    path: src/codealmanac/server/assets/viewer/main.js
    note: Client-side viewer entrypoint.
```

Verification:

- `rg "files:" src tests README.md AGENTS.md MANUAL.md docs`
- `uv run pytest tests/test_wiki_parsing.py tests/test_search.py tests/test_read_model.py`

## Ticket 4: Retire Wikilinks And Use Markdown Links

Goal: make page links feel like normal docs.

Todos:

- Stop treating `[[...]]` as the authored page-link format.
- Parse root-style Markdown links as page links:
  - `[Sidebar](/architecture/viewer/navigation/sidebar)`
- Keep repo file references in `sources:`, not wikilinks.
- Remove wikilink docs from prompts, manual, README, and AGENTS.md.
- Update backlink extraction to use Markdown page links.
- Update broken-link health checks for Markdown links.

Verification:

- Add tests for Markdown page links.
- Add tests for backlink extraction from Markdown links.
- Add tests that wikilinks are not required anywhere in new pages.
- `uv run pytest tests/test_wiki_parsing.py tests/test_health.py tests/test_read_model.py`

## Ticket 5: Move Runtime State To `~/.codealmanac/`

Goal: keep committed `almanac/` clean.

Todos:

- Keep global registry at `~/.codealmanac/registry.json`.
- Add a per-repo runtime directory:
  - `~/.codealmanac/repos/<repo-id>/`
- Move derived index state there:
  - `index.db`
  - `index.db-wal`
  - `index.db-shm`
- Move run state there:
  - `runs/run_123.json`
  - `runs/run_123.jsonl`
  - `runs/run_123.spec.json`
- Keep one SQLite DB per repo.
- Make missing runtime state rebuildable.
- Remove runtime `.gitignore` entries that were only needed inside `almanac/`.

Files:

- `src/codealmanac/core/paths.py`
- `src/codealmanac/services/workspaces/`
- `src/codealmanac/services/index/schema.py`
- `src/codealmanac/services/runs/paths.py`
- `src/codealmanac/services/runs/io.py`
- `src/codealmanac/services/wiki/templates.py`

Verification:

- Tests prove `almanac/` contains only wiki source files.
- Tests prove index/runs land under `~/.codealmanac/repos/<repo-id>/`.
- `uv run pytest tests/test_run_queue_workflow.py tests/test_viewer_service.py tests/test_read_model.py`

## Ticket 6: Add `codealmanac validate`

Goal: give agents and lifecycle runs one concrete correctness check.

Todos:

- Add `codealmanac validate`.
- Validate page ids and route collisions.
- Validate Markdown links resolve.
- Validate `sources:` shape.
- Validate file sources point to real repo paths in the current checkout.
- Validate the derived DB/index matches the current markdown tree.
- Validate runtime files are not inside committed `almanac/`.
- Run validation automatically before a lifecycle run finishes.

Files:

- `src/codealmanac/services/health/`
- `src/codealmanac/cli/parser/wiki.py`
- `src/codealmanac/cli/dispatch/wiki.py`
- `src/codealmanac/cli/render/`
- `tests/test_health.py`
- `tests/test_cli.py`

Verification:

- `codealmanac validate` passes on a good wiki.
- `codealmanac validate` fails on a broken Markdown link.
- `codealmanac validate` fails on route collisions.
- `uv run pytest tests/test_health.py tests/test_cli.py`

## Ticket 7: Bring Over Kushagra's Prompt And Manual

Goal: import the new prompt/manual work carefully, without cloud bloat.

Todos:

- Compare `e773dc0b` against `dev` for:
  - `src/codealmanac/prompts/`
  - `src/codealmanac/manual/`
  - relevant `docs/almanac/` material
- Bring over the new prompt/manual content that matches the local product.
- Do not blindly check out cloud-era files.
- Remove hosted/cloud assumptions.
- Rewrite prompt/manual rules for:
  - only `almanac/`
  - nested folder pages
  - no `pages/`
  - `sources:` only
  - Markdown links
  - no slugs
  - no wikilinks
  - path-first page ids
  - auto-commit default
  - home-dir runtime state
- Update prompt model enums/resources.
- Update package-data tests.

Diff commands:

```bash
git diff --name-status e773dc0b..dev -- src/codealmanac/prompts src/codealmanac/manual docs/almanac
git show dev:src/codealmanac/prompts/base/kernel.md
git show dev:src/codealmanac/prompts/operations/ingest.md
git show dev:src/codealmanac/prompts/operations/garden.md
```

Verification:

- Prompt rendering tests pass.
- Public contract tests pass.
- Manual text contains the new product rules.
- `uv run pytest tests/test_public_contract.py tests/test_prompts.py`

## Ticket 8: Make Lifecycle Runs Generous But Bounded

Goal: explicit runs can edit the current wiki state without requiring a clean
`almanac/`.

Todos:

- Remove the clean-`almanac/` preflight block.
- Keep before/after Git snapshots.
- Allow pre-existing `almanac/` changes.
- Reject agent changes outside `almanac/`.
- Validate the final wiki.
- Keep run event ordering: persist events before page-write mutations where
  applicable.
- Make safety errors clear and actionable.

Files:

- `src/codealmanac/workflows/lifecycle_mutation.py`
- `src/codealmanac/workflows/page_run/service.py`
- `tests/test_ingest_workflow.py`
- `tests/test_garden_workflow.py`

Verification:

- Test dirty `almanac/` before run is allowed.
- Test dirty source file before run does not matter.
- Test agent-created source-file change fails.
- `uv run pytest tests/test_ingest_workflow.py tests/test_garden_workflow.py`

## Ticket 9: Pass Commit Policy Into Lifecycle Prompts

Goal: make auto-commit a prompt-level permission, not CodeAlmanac Git
orchestration.

Todos:

- Add `auto_commit = true` default config.
- Add `codealmanac setup --no-auto-commit`.
- Add `codealmanac config set auto_commit false`.
- When enabled, include source-control runtime context in lifecycle prompts:
  - committing wiki source changes is allowed,
  - use normal `git` commands,
  - commit only wiki source files,
  - use commit message shape `almanac: <summary>`.
- When disabled, include prompt context that says not to commit.
- Do not add a Git committer service.
- Do not stage files inside CodeAlmanac.
- Do not split pre-existing `almanac/` edits from agent edits.
- Do not transport commits across branches or worktrees.
- Prompt-allowed wiki source files:
  - `almanac/**/*.md`
  - `almanac/topics.yaml`
  - `almanac/config.toml`
- Prompt-forbidden files:
  - runtime state,
  - app source files,
  - logs,
  - unrelated repo files.

Files:

- `src/codealmanac/services/config/`
- `src/codealmanac/services/setup/`
- `src/codealmanac/workflows/page_run/`
- lifecycle prompt/context builders under `src/codealmanac/prompts/`
- `tests/test_ingest_workflow.py`
- `tests/test_cli.py`

Verification:

- Test enabled config renders commit-allowed prompt context.
- Test disabled config renders do-not-commit prompt context.
- Test no CodeAlmanac Git committer/staging integration exists.
- `uv run pytest tests/test_ingest_workflow.py tests/test_cli.py`

## Ticket 10: Implement Scheduled Auto-Update

Goal: keep CodeAlmanac updated automatically through its own automation task.

Todos:

- Add an `update` automation task.
- Install it by default during setup.
- Run it as a separate scheduled job, not inside sync or Garden.
- Add a global update lock under `~/.codealmanac/`.
- Skip update if another CodeAlmanac job is active.
- Support uv tool installs and pip installs.
- Skip editable/source installs.
- Log updater output under `~/.codealmanac/logs/`.
- Run a post-update smoke:
  - `codealmanac --version`
  - quick doctor/check command

Files:

- `src/codealmanac/services/automation/`
- `src/codealmanac/services/updates/`
- `src/codealmanac/integrations/automation/`
- `src/codealmanac/cli/parser/updates.py`
- `tests/test_automation_service.py`
- `tests/test_cli.py`

Verification:

- Test setup installs update automation.
- Test uninstall removes update automation.
- Test editable installs skip auto-update.
- `uv run pytest tests/test_automation_service.py tests/test_cli.py`

## Ticket 11: Make Uninstall Fully Remove Machine State

Goal: `codealmanac uninstall` fully removes CodeAlmanac-owned machine artifacts.

Todos:

- Remove global agent instructions.
- Remove sync, Garden, and update automation.
- Remove `~/.codealmanac/` global state.
- Remove installed binary/tool when the install method supports it.
- Do not delete repo `almanac/`.
- Remove `--target`, `--keep-automation`, `--keep-instructions`, and any other
  partial-uninstall flags.
- Keep a non-destructive confirmation path for interactive terminals.
- Keep `--yes` non-interactive.

Files:

- `src/codealmanac/services/setup/`
- `src/codealmanac/services/updates/`
- `src/codealmanac/integrations/setup/`
- `src/codealmanac/integrations/automation/`
- `tests/test_setup_service.py`
- `tests/test_cli.py`

Verification:

- Test uninstall removes instructions.
- Test uninstall removes all automation tasks.
- Test uninstall removes `~/.codealmanac/`.
- Test uninstall does not delete repo `almanac/`.
- `uv run pytest tests/test_setup_service.py tests/test_cli.py`

## Ticket 12: Restore The Branded Onboarding TUI

Goal: bring back the archive onboarding experience in the Python CLI.

Todos:

- Port the archive setup feel:
  - banner,
  - badge,
  - step markers,
  - interactive questions,
  - next-steps box.
- Keep Python implementation patterns.
- Remove hosted/self-managed split.
- New setup flow:
  - `[1/4] Agent instructions`,
  - `[2/4] Wiki maintenance`,
  - `[3/4] Product updates`,
  - `[4/4] Agent change handling`,
  - final next step: `cd /path/to/your/repo` then `codealmanac init`.
- Every interactive setup choice uses a left/right or equivalent directional
  visual surface, with a visible `[n/4]` progress marker.
- The agent change handling screen previews the literal consequence of each
  choice:
  - commit mode shows a small git log with a new `almanac: ...` commit,
  - worktree mode shows a simplified VS Code-style diff list with file paths
    and `-N +N` counts.
- Approved agent change handling mock:

```text
◆  [4/4] Agent change handling

   Should agents commit wiki changes or leave them in the worktree?

   ┌────────────────────────────────────┐   ┌────────────────────────────────────┐
   │ Commit changes                     │   │ Leave in worktree                  │
   │                                    │   │                                    │
   │  ● almanac: update wiki context    │   │  almanac/architecture/indexing.md  │
   │  │ rohan · just now                │   │                         -18 +42    │
   │  │                                 │   │  almanac/decisions/local-first.md  │
   │  ● docs: previous repo commit      │   │                          -4 +19    │
   │  │ rohan · earlier                 │   │  almanac/guides/setup.md           │
   │                                    │   │                          -2 +11    │
   └────────────────────────────────────┘   └────────────────────────────────────┘
              selected

   [←/→] switch   [enter] choose
```

- When worktree mode is selected, the same screen moves the selected indicator
  under the diff card.
- The implementation should color the selected border/indicator, dim the
  unselected card, color diff counts red/green, and keep the commit preview
  legible.
- The mental model is:
  - commit mode means the user sees a clean `almanac: ...` commit,
  - worktree mode means the user sees modified files and diff counts.
- `codealmanac setup` is computer-level onboarding. It must not initialize,
  detect, register, or mutate a repo `almanac/` tree.
- Support `--yes`.
- Support non-TTY behavior.
- Keep JSON output for scripts.

Archive reference files:

- `archive/code/src/cli/commands/setup/output.ts`
- `archive/code/src/cli/commands/setup/index.ts`
- `archive/code/src/cli/commands/setup/setup-plan.ts`
- `archive/code/src/cli/commands/setup/auto-update-step.ts`
- `archive/code/src/cli/commands/setup/auto-commit-step.ts`

Python target files:

- `src/codealmanac/cli/render/setup.py`
- `src/codealmanac/services/setup/`
- `tests/test_setup_service.py`
- `tests/test_cli.py`

Verification:

- Snapshot-style tests for setup output.
- Tests for `--yes`.
- Tests for JSON output.
- Tests for idempotent rerun.
- `uv run pytest tests/test_setup_service.py tests/test_cli.py`

## Ticket 13: Restore Three Operation Architecture

Goal: make `codealmanac init` delegate to a model-backed internal `build`
operation and make `build`, `ingest`, and `garden` the only internal wiki
operations.

Non-negotiables:

- `codealmanac init` is public.
- `codealmanac build` is not public.
- run records use only `build`, `ingest`, or `garden`.
- `sync` creates `ingest` runs and is not a run operation.
- `update` is product maintenance and is not a wiki operation.
- `capture` is retired language.
- Kushagra's prompt/manual material from commit `4c615718` is copied literally
  first and adapted only for Python/nested `almanac/` format.

Todos:

- Port Kushagra's July init prompt from `4c615718` into the Python package as
  `src/codealmanac/prompts/operations/build.md`.
- Preserve Kushagra's writing-subagent, coverage-map, topics, and article
  quality instructions.
- Adapt only the current product facts: `init` as public command, `build` as
  internal operation, `almanac/` as the only repo wiki root, browseable nested
  Markdown pages, Markdown links, `sources:` evidence, and three operation
  names.
- Make `codealmanac init` create/register `almanac/`, start a `build` run,
  invoke the lifecycle harness, validate mutations under `almanac/`, refresh
  the index, and validate wiki health.
- Keep deterministic scaffold/index work private to services. It is not a
  public operation.
- Remove `RunOperation.SYNC`.
- Keep `sync` as transcript intake that starts `ingest` runs.
- Keep setup next steps focused on navigating to a repo and running
  `codealmanac init`.
- Test that `init` records operation `build`.
- Test that `codealmanac build` is rejected by the parser.
- Test that sync-created runs record operation `ingest`.

Files:

- `src/codealmanac/cli/dispatch/build.py`
- `src/codealmanac/cli/parser/lifecycle.py`
- `src/codealmanac/services/runs/models.py`
- `src/codealmanac/workflows/build/`
- `src/codealmanac/workflows/run_queue/`
- `src/codealmanac/workflows/sync/`
- `src/codealmanac/prompts/operations/build.md`
- `src/codealmanac/manual/`
- `tests/test_build_workflow.py`
- `tests/test_cli.py`
- `tests/test_sync_workflow.py`
- `tests/test_public_contract.py`

Verification:

- `uv run pytest tests/test_build_workflow.py tests/test_cli.py tests/test_sync_workflow.py tests/test_public_contract.py`
- `uv run ruff check .`

## Ticket 14: Rebuild Viewer Around Folder Browsing

Goal: make the viewer match the new `almanac/` tree.

Todos:

- Keep Alpine-inspired visual style.
- Replace flat page list as the primary experience with folder browsing.
- Show nested folders and pages.
- Show page path in header.
- Render Markdown links as internal page navigation.
- Show sources panel.
- Show backlinks derived from Markdown links.
- Keep search and topics as alternate entry points.
- Remove jobs/runtime assumptions tied to repo-local `almanac/jobs/`.

Files:

- `src/codealmanac/server/assets/app.css`
- `src/codealmanac/server/assets/viewer/`
- `src/codealmanac/services/viewer/`
- `tests/test_viewer_service.py`
- `tests/test_viewer_ui_assets.py`

Verification:

- Service tests for folder tree DTOs.
- UI asset tests for route helpers.
- Browser/manual smoke after dev server starts.
- `uv run pytest tests/test_viewer_service.py tests/test_viewer_ui_assets.py`

## Ticket 15: End-To-End Cleanup And Release Audit

Goal: prove the rebuilt local product is coherent.

Todos:

- Remove obsolete compatibility code.
- Remove hosted/cloud leftovers.
- Remove `pages/`, `files:`, `slug:`, and wikilink assumptions.
- Update docs and tests.
- Run full test suite.
- Run lint.
- Run a local smoke:
  - setup,
  - init,
  - ingest,
  - validate,
  - search,
  - show,
  - serve,
  - uninstall.

Verification:

```bash
uv run ruff check .
uv run pytest
```

Manual smoke leaves:

```text
repo/almanac/                  # clean committed wiki source
~/.codealmanac/repos/<repo-id> # derived runtime state
```

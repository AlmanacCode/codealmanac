# Init First-Build And Prompt Restoration

## Decision

There is no public `codealmanac build` command.

`codealmanac init` is the first-build lifecycle command. It creates or refreshes
the configured Almanac root, installs the wiki manual, and runs the initial
agent-backed wiki construction using the restored archive prompt doctrine.

`codealmanac reindex` remains the command for refreshing the derived SQLite
read model.

## Why This Plan Exists

The Python port cleaned up architecture, but it accidentally weakened product
behavior:

- current `init` mostly scaffolds files;
- current `build` behaves like scaffold plus index refresh;
- the archive first-build prompt is missing;
- base prompts and operation prompts were compressed into thin summaries;
- tests now encode the simplified behavior.

The fix is to restore the archive behavior in Python shape, not preserve the
current accidental split.

## Source Material To Port

Read these before coding:

- `MANUAL.md`
- `docs/python-port-live-agreement.md`
- `archive/code/prompts/base/purpose.md`
- `archive/code/prompts/base/notability.md`
- `archive/code/prompts/base/syntax.md`
- `archive/code/prompts/operations/build.md`
- `archive/code/prompts/operations/absorb.md`
- `archive/code/prompts/operations/garden.md`
- `archive/code/src/operations/build.ts`
- `archive/code/src/cli/register-wiki-lifecycle-commands.ts`
- `archive/code/src/init/scaffold.ts`
- `archive/code/guides/mini.md`
- `archive/code/guides/reference.md`
- `archive/code/guides/processing/`

## Target Command Contract

```text
codealmanac init [path] [--root <repo-relative-path>]
  [--using <provider[/model]>]
  [--background | --foreground]
  [--force]
  [--yes]
  [--verbose]
  [--json]
```

Rules:

- `init` is the only public first-build command.
- `init` refuses to rebuild a populated wiki unless `--force` is passed.
- `init --background` creates a durable job and starts a worker.
- foreground `init` can stream normalized harness events.
- `--json` is for structured job/start output, not mixed human streaming.
- no public `codealmanac build` parser entry remains.
- docs/tests must not teach users to run `codealmanac build`.

## Architecture Shape

Use the same service/workflow style as the rest of the Python port.

```python
app.workflows.init.run(RunInitRequest(...))
app.workflows.init.run_with_run(RunInitWithRunRequest(...))
app.workflows.run_queue.queue_init(RunInitRequest(...))
```

Expected responsibilities:

- init workflow: resolve workspace, initialize scaffold/manual, count existing
  pages, enforce `--force`, render the first-build prompt, then delegate page
  writing to `PageRunWorkflow`;
- page-run workflow: unchanged shared lifecycle machinery for harness events,
  mutation safety, run records, logs, outputs, and index refresh;
- run queue: accept `JobOperation.INIT` specs alongside ingest/garden;
- CLI: parse flags and call workflows; no internal shelling out to
  `codealmanac`.

The implementation may use an internal name such as `first_build`, but the
public command and user-facing lifecycle word is `init`.

## Prompt Restoration

Port prompts closely instead of summarizing them.

Adaptations allowed:

- `codealmanac` product/command naming;
- configured Almanac root instead of hard-coded `.almanac/`;
- `manual/` instead of archive `_manual/`;
- public `ingest` instead of public `absorb`;
- no public `almanac`/`alm` compatibility language;
- no hosted/login/upload/MCP/SDK surfaces;
- no `archived_at`, `superseded_by`, or `supersedes` page lineage fields.

Prompt mapping:

| Archive | Python target |
|---|---|
| `base/purpose.md` | `src/codealmanac/prompts/base/purpose.md` |
| `base/notability.md` | `src/codealmanac/prompts/base/notability.md` |
| `base/syntax.md` | `src/codealmanac/prompts/base/syntax.md` |
| `operations/build.md` | `src/codealmanac/prompts/operations/init.md` or `first_build.md` |
| `operations/absorb.md` | `src/codealmanac/prompts/operations/ingest.md` |
| `operations/garden.md` | `src/codealmanac/prompts/operations/garden.md` |

Do not keep the current thin prompt files as the final wording.

## Manual Restoration

The package manual should be expanded from the archive guide/manual material,
then adapted to the Python product contract.

Use these sources:

- archive scaffold manual text in `archive/code/src/init/scaffold.ts`;
- archive agent guides in `archive/code/guides/`;
- current Python manual files where they correctly explain configured roots,
  evidence authority, local-only scope, and `codealmanac` naming.

The configured Almanac root should still contain:

```text
<almanac-root>/
|-- README.md
|-- topics.yaml
|-- pages/
|-- manual/
```

The manual must explain the real first-build behavior: `init` creates the first
substantial wiki, not only a starter scaffold.

## Tests To Change

Update tests that currently protect the wrong behavior:

- remove parser/CLI expectations for public `build`;
- make `init` test the first-build lifecycle path;
- add background `init` queue tests;
- add run-spec validation for `JobOperation.INIT`;
- add prompt inventory tests proving the init/ingest/garden prompt resources
  exist;
- add manual inventory tests for the restored manual resources;
- keep `reindex` tests for SQLite read-model refresh.

## Out Of Scope

- public `absorb`;
- public `almanac` or `alm` aliases;
- hosted login/connect/upload;
- MCP or SDK surfaces;
- old-user migration commands;
- archive page lineage fields.

## Verification

Minimum gates after implementation:

```bash
uv run pytest
uv run ruff check .
uv run codealmanac --help
uv run codealmanac init --help
uv run codealmanac init <temp-repo> --using codex --foreground --verbose
uv run codealmanac search --wiki <temp-wiki> getting-started
uv run codealmanac reindex --wiki <temp-wiki>
```

For real dogfood, run `codealmanac init --force` on a disposable copy of this
repo and inspect the resulting wiki diff before calling the slice complete.

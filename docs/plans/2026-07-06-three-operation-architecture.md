# Three Operation Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make CodeAlmanac have exactly three internal wiki operations: `build`, `ingest`, and `garden`; make `codealmanac init` the public front door for the internal `build` operation; copy Kushagra's July 2026 init prompt and manual material literally from git history, changing only the current Python/nested-`almanac/` format facts.

**Architecture:** Public commands and internal operations are separate concepts. `init` is a public command that starts a `build` run. `sync` is transcript intake that creates `ingest` runs. `update` is product maintenance. Only `build`, `ingest`, and `garden` are stored as run operations, prompt operations, queue operations, and viewer/job operation labels.

**Tech Stack:** Python 3.12, Pydantic, pytest, ruff, package resources via `importlib.resources`, local harness adapters, SQLite-backed runtime state under `~/.codealmanac/`.

---

## Non-Negotiable Product Truth

- Internal wiki operations are exactly: `build`, `ingest`, `garden`.
- `sync` is not an operation. It is a transcript intake command/scheduled task that starts `ingest` runs.
- `capture` is legacy language. It must not appear in current user-facing docs, manual, setup copy, command help, or AGENTS guide.
- `update` is not a wiki operation. It is product maintenance.
- `codealmanac init` is the front-facing command for the internal `build` operation.
- There is no public `codealmanac build` command.
- No backwards compatibility shims, aliases, hidden compatibility commands, or dual docs.
- Kushagra's prompt/manual material is copied literally first from commit `4c6157180409af7ab734b7d6e74c1eccaa656ec0` (`docs(init): tune first-wiki planning and writing prompts`, July 4, 2026). Edits are limited to required product-format changes:
  - command name: `almanac` -> `codealmanac`;
  - internal operation heading: `Init Operation` -> `Build Operation`;
  - page layout: `pages/<slug>.md` under an Almanac root -> browseable nested Markdown directly under `almanac/`;
  - `[[...]]` wiki links -> Markdown links and structured source evidence;
  - runtime state paths -> `~/.codealmanac/`;
  - operation wording -> exactly `build`, `ingest`, and `garden`.

---

## Task 1: Correct The Written Source Of Truth

**Files:**
- Modify: `notes.md`
- Modify: `implementation-tickets.md`
- Create: `docs/plans/2026-07-06-three-operation-architecture.md`

**Step 1: Remove the wrong init/build decision from `notes.md`**

Replace the current wrong claim that "`build` should not remain public-facing" with:

```markdown
`codealmanac init` is the public command for the first wiki build. Internally it
starts a `build` operation. There are exactly three internal wiki operations:
`build`, `ingest`, and `garden`. `sync` is transcript intake that creates
`ingest` runs. `update` is product maintenance. `capture` is retired language.
```

**Step 2: Replace Ticket 13 in `implementation-tickets.md`**

Rewrite Ticket 13 as:

```markdown
## Ticket 13: Restore Three Operation Architecture

Goal: make `init` delegate to a model-backed `build` operation and make
`build`, `ingest`, and `garden` the only internal wiki operations.

Non-negotiables:
- `codealmanac init` is public.
- `codealmanac build` is not public.
- run records use only `build`, `ingest`, or `garden`.
- `sync` creates `ingest` runs and is not a run operation.
- Kushagra's prompt/manual material from commit `4c615718` is copied literally
  first and adapted only for Python/nested `almanac/` format.
```

**Step 3: Run the docs grep**

Run:

```bash
rg -n "build should not remain|RunOperation\\.SYNC|capture|absorb|\\.almanac/pages|files:" notes.md implementation-tickets.md docs src/codealmanac/manual src/codealmanac/prompts
```

Expected:
- no stale source-of-truth claim that public `build` replaces `init`;
- no current manual/doc reference to `capture`;
- no current manual/doc reference to legacy `absorb`;
- remaining `.almanac/pages` or `files:` hits are only inside explicit migration history.

**Step 4: Commit**

```bash
git add notes.md implementation-tickets.md docs/plans/2026-07-06-three-operation-architecture.md
git commit -m "docs: lock three operation architecture"
```

---

## Task 2: Copy Kushagra's July Prompt And Manual Sources

**Files:**
- Source commit: `4c6157180409af7ab734b7d6e74c1eccaa656ec0`
- Related Kushagra commit: `cfef4867d9d2c65685b4029701ca367625deb76d`
- Related Kushagra commit: `597f95deab54cddc31f3c6cc0925515ced3ab911`
- Related Kushagra commit: `6683b4011ede92b197b40ad7b00d5ea4be5e4a72`
- Source: `4c615718:src/codealmanac/prompts/base/kernel.md`
- Source: `4c615718:src/codealmanac/prompts/operations/init.md`
- Source: `4c615718:src/codealmanac/prompts/operations/ingest.md`
- Source: `4c615718:src/codealmanac/prompts/operations/garden.md`
- Source: `4c615718:src/codealmanac/manual/README.md`
- Source: `4c615718:src/codealmanac/manual/architecture.md`
- Source: `4c615718:src/codealmanac/manual/concepts.md`
- Source: `4c615718:src/codealmanac/manual/decisions.md`
- Source: `4c615718:src/codealmanac/manual/evidence.md`
- Source: `4c615718:src/codealmanac/manual/garden.md`
- Source: `4c615718:src/codealmanac/manual/how-to-guides.md`
- Source: `4c615718:src/codealmanac/manual/how-to-write.md`
- Source: `4c615718:src/codealmanac/manual/ingest.md`
- Source: `4c615718:src/codealmanac/manual/links.md`
- Source: `4c615718:src/codealmanac/manual/reference.md`
- Source: `4c615718:src/codealmanac/manual/sources.md`
- Source: `4c615718:src/codealmanac/manual/topics.md`
- Replace: `src/codealmanac/prompts/base/kernel.md`
- Create: `src/codealmanac/prompts/operations/build.md`
- Replace: `src/codealmanac/prompts/operations/ingest.md`
- Replace: `src/codealmanac/prompts/operations/garden.md`
- Replace: `src/codealmanac/manual/README.md`
- Replace: `src/codealmanac/manual/architecture.md`
- Replace: `src/codealmanac/manual/concepts.md`
- Replace: `src/codealmanac/manual/decisions.md`
- Replace: `src/codealmanac/manual/evidence.md`
- Replace: `src/codealmanac/manual/garden.md`
- Replace: `src/codealmanac/manual/how-to-guides.md`
- Replace: `src/codealmanac/manual/how-to-write.md`
- Replace: `src/codealmanac/manual/ingest.md`
- Replace: `src/codealmanac/manual/links.md`
- Replace: `src/codealmanac/manual/reference.md`
- Replace: `src/codealmanac/manual/sources.md`
- Replace: `src/codealmanac/manual/topics.md`
- Modify: `src/codealmanac/prompts/models.py`
- Modify: `src/codealmanac/manual/models.py`
- Test: `tests/test_prompt_manual_kushagra_port.py`
- Test: `tests/test_manual.py`

**Step 1: Copy first, before editing**

Run:

```bash
git show 4c615718:src/codealmanac/prompts/base/kernel.md > src/codealmanac/prompts/base/kernel.md
git show 4c615718:src/codealmanac/prompts/operations/init.md > src/codealmanac/prompts/operations/build.md
git show 4c615718:src/codealmanac/prompts/operations/ingest.md > src/codealmanac/prompts/operations/ingest.md
git show 4c615718:src/codealmanac/prompts/operations/garden.md > src/codealmanac/prompts/operations/garden.md
git show 4c615718:src/codealmanac/manual/README.md > src/codealmanac/manual/README.md
git show 4c615718:src/codealmanac/manual/architecture.md > src/codealmanac/manual/architecture.md
git show 4c615718:src/codealmanac/manual/concepts.md > src/codealmanac/manual/concepts.md
git show 4c615718:src/codealmanac/manual/decisions.md > src/codealmanac/manual/decisions.md
git show 4c615718:src/codealmanac/manual/evidence.md > src/codealmanac/manual/evidence.md
git show 4c615718:src/codealmanac/manual/garden.md > src/codealmanac/manual/garden.md
git show 4c615718:src/codealmanac/manual/how-to-guides.md > src/codealmanac/manual/how-to-guides.md
git show 4c615718:src/codealmanac/manual/how-to-write.md > src/codealmanac/manual/how-to-write.md
git show 4c615718:src/codealmanac/manual/ingest.md > src/codealmanac/manual/ingest.md
git show 4c615718:src/codealmanac/manual/links.md > src/codealmanac/manual/links.md
git show 4c615718:src/codealmanac/manual/reference.md > src/codealmanac/manual/reference.md
git show 4c615718:src/codealmanac/manual/sources.md > src/codealmanac/manual/sources.md
git show 4c615718:src/codealmanac/manual/topics.md > src/codealmanac/manual/topics.md
```

**Step 2: Apply only required current-product edits**

Edit only the copied files. Apply these exact categories:

```text
Init Operation heading         -> Build Operation heading
init operation wording         -> build operation wording where it names the internal operation
pages/<slug>.md paths          -> nested Markdown paths directly under almanac/
pages/ folder wording          -> browseable nested almanac/ tree wording
[[page]] links                 -> Markdown links
[[file/path.py]] file links    -> structured sources evidence or Markdown file links
configured Almanac root aliases -> almanac/ only
sync/capture legacy wording    -> sync is transcript intake; capture is retired
operation list                 -> build, ingest, garden only
```

Do not rewrite style, voice, examples, algorithms, coverage-map requirements, writing-subagent requirements, topic guidance, page-type manuals, or article-quality language except where the old format is factually wrong for the current product.

**Step 3: Keep Kushagra's kernel base prompt shape**

Update `src/codealmanac/prompts/models.py`:

```python
class PromptName(StrEnum):
    BASE_KERNEL = "base/kernel.md"
    OPERATION_BUILD = "operations/build.md"
    OPERATION_INGEST = "operations/ingest.md"
    OPERATION_GARDEN = "operations/garden.md"
```

Delete `OPERATION_INIT` from the prompt enum. `codealmanac init` renders `OPERATION_BUILD`.

**Step 4: Keep Kushagra's manual inventory**

Update `src/codealmanac/manual/models.py`:

```python
class ManualDocumentName(StrEnum):
    README = "README.md"
    HOW_TO_WRITE = "how-to-write.md"
    EVIDENCE = "evidence.md"
    LINKS = "links.md"
    TOPICS = "topics.md"
    CONCEPTS = "concepts.md"
    ARCHITECTURE = "architecture.md"
    HOW_TO_GUIDES = "how-to-guides.md"
    DECISIONS = "decisions.md"
    REFERENCE = "reference.md"
    SOURCES = "sources.md"
    INGEST = "ingest.md"
    GARDEN = "garden.md"


MANUAL_DOCUMENTS: tuple[ManualDocumentName, ...] = (
    ManualDocumentName.README,
    ManualDocumentName.HOW_TO_WRITE,
    ManualDocumentName.EVIDENCE,
    ManualDocumentName.LINKS,
    ManualDocumentName.TOPICS,
    ManualDocumentName.CONCEPTS,
    ManualDocumentName.ARCHITECTURE,
    ManualDocumentName.HOW_TO_GUIDES,
    ManualDocumentName.DECISIONS,
    ManualDocumentName.REFERENCE,
    ManualDocumentName.SOURCES,
    ManualDocumentName.INGEST,
    ManualDocumentName.GARDEN,
)
```

Delete any obsolete manual documents not in this inventory.

**Step 5: Add Kushagra-port tests**

Create `tests/test_prompt_manual_kushagra_port.py` with tests that:

- read each source file from commit `4c615718` using `git show`;
- read each Python destination file;
- assert destination manual documents preserve Kushagra's headings;
- assert `src/codealmanac/prompts/operations/build.md` preserves the phrases "Phase 1: Scan And Plan", "coverage-map.md", "Use read-only research sub-agents", "Use writing sub-agents", and "The main agent is the orchestrator";
- assert no destination contains public `codealmanac build`;
- assert no destination contains `capture` as a current command;
- assert no destination contains stale `pages/` layout instructions after the nested-tree adaptation;
- assert no destination contains `[[` link syntax after the Markdown-link adaptation.

**Step 6: Run focused tests**

```bash
uv run pytest tests/test_manual.py tests/test_prompt_manual_kushagra_port.py -q
uv run ruff check src/codealmanac/prompts src/codealmanac/manual tests/test_prompt_manual_kushagra_port.py
```

Expected: pass.

**Step 7: Commit**

```bash
git add src/codealmanac/prompts src/codealmanac/manual tests/test_manual.py tests/test_prompt_manual_kushagra_port.py
git commit -m "feat: port Kushagra init prompt and manual"
```

---

## Task 3: Make RunOperation Exactly Build, Ingest, Garden

**Files:**
- Modify: `src/codealmanac/services/runs/models.py`
- Modify: `tests/test_runs_service.py`
- Modify: `tests/test_public_contract.py`
- Modify: `tests/test_sync_workflow.py`
- Modify: `tests/test_run_queue_workflow.py`

**Step 1: Remove `SYNC` from `RunOperation`**

Update:

```python
class RunOperation(StrEnum):
    BUILD = "build"
    INGEST = "ingest"
    GARDEN = "garden"
```

**Step 2: Update `RunSpec.validate_operation_payload`**

Use this operation payload contract:

```python
@model_validator(mode="after")
def validate_operation_payload(self) -> "RunSpec":
    if self.version != 1:
        raise ValueError("run spec version must be 1")
    if self.operation == RunOperation.BUILD:
        if len(self.inputs) > 0:
            raise ValueError("build run spec does not accept inputs")
        return self
    if self.operation == RunOperation.INGEST:
        if len(self.inputs) == 0:
            raise ValueError("ingest run spec requires inputs")
        return self
    if self.operation == RunOperation.GARDEN:
        if len(self.inputs) > 0:
            raise ValueError("garden run spec does not accept inputs")
        return self
    raise ValueError(f"unsupported queued run operation: {self.operation.value}")
```

**Step 3: Add public contract test**

Add:

```python
def test_run_operations_are_only_build_ingest_garden():
    assert tuple(operation.value for operation in RunOperation) == (
        "build",
        "ingest",
        "garden",
    )
```

**Step 4: Add sync contract test**

Add or update a sync test so a ready transcript creates a queued run with:

```python
assert run.operation == RunOperation.INGEST
```

and never creates a run with operation `"sync"`.

**Step 5: Run focused tests**

```bash
uv run pytest tests/test_runs_service.py tests/test_run_queue_workflow.py tests/test_sync_workflow.py tests/test_public_contract.py -q
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/codealmanac/services/runs/models.py tests/test_runs_service.py tests/test_run_queue_workflow.py tests/test_sync_workflow.py tests/test_public_contract.py
git commit -m "refactor: restrict wiki operations to build ingest garden"
```

---

## Task 4: Split Public Commands From Internal Operations

**Files:**
- Modify: `src/codealmanac/cli/parser/lifecycle.py`
- Modify: `src/codealmanac/cli/dispatch/lifecycle.py`
- Modify: `src/codealmanac/cli/dispatch/build.py`
- Modify: `src/codealmanac/cli/render/lifecycle.py`
- Modify: `src/codealmanac/cli/render/root.py`
- Modify: `tests/test_cli.py`
- Modify: `tests/test_public_contract.py`

**Step 1: Keep public lifecycle commands explicit**

Public lifecycle commands are:

```text
init
ingest
garden
sync
```

The public parser still rejects:

```text
build
capture
absorb
```

`init` maps to `RunOperation.BUILD`.
`ingest` maps to `RunOperation.INGEST`.
`garden` maps to `RunOperation.GARDEN`.
`sync` maps to transcript intake and produces `ingest` runs.

**Step 2: Add build operation flags to `init`**

In `src/codealmanac/cli/parser/lifecycle.py`, make `init` accept the model-backed operation controls:

```python
init.add_argument("path", nargs="?", default=".")
init.add_argument("--name")
init.add_argument("--description", default="")
init.add_argument("--using", choices=tuple(kind.value for kind in HarnessKind))
init.add_argument("--title")
init.add_argument("--guidance")
init.add_argument("--force", action="store_true")
init.add_argument("--background", action="store_true")
init.add_argument("--foreground", action="store_true")
init.add_argument("--json", action="store_true")
```

**Step 3: Make dispatch naming honest**

`dispatch_init` calls the build workflow operation runner, not deterministic indexing:

```python
def dispatch_init(args: argparse.Namespace, app: CodeAlmanac) -> int:
    request = build_request(args)
    if args.background:
        result = app.workflows.queue.start_build_background(request)
        render_queued_operation(result, json_output=args.json)
        return 0
    result = app.workflows.build.run(request)
    render_build_operation(result)
    return 0
```

Use the actual project render names during implementation. The behavior is fixed: foreground by default, background by explicit flag.

**Step 4: Keep `codealmanac build` rejected**

Test:

```python
with pytest.raises(SystemExit):
    parser.parse_args(("build",))
assert "invalid choice: 'build'" in capsys.readouterr().err
```

**Step 5: Update init CLI tests**

`codealmanac init` now:

- starts a `build` run;
- records operation `build`;
- invokes the harness with the Kushagra-derived build prompt;
- writes pages through the harness;
- refreshes index;
- renders run status and wiki path.

**Step 6: Run focused tests**

```bash
uv run pytest tests/test_cli.py tests/test_public_contract.py -q
uv run ruff check src/codealmanac/cli tests/test_cli.py tests/test_public_contract.py
```

Expected: pass.

**Step 7: Commit**

```bash
git add src/codealmanac/cli tests/test_cli.py tests/test_public_contract.py
git commit -m "feat: route init to build operation"
```

---

## Task 5: Implement Model-Backed Build Workflow

**Files:**
- Modify: `src/codealmanac/workflows/build/service.py`
- Modify: `src/codealmanac/workflows/build/models.py`
- Create: `src/codealmanac/workflows/build/requests.py`
- Modify: `src/codealmanac/workflows/build/__init__.py`
- Modify: `src/codealmanac/app.py`
- Modify: `src/codealmanac/workflows/page_run/service.py`
- Modify: `src/codealmanac/workflows/lifecycle_mutation.py`
- Modify: `tests/test_build_workflow.py`

**Step 1: Add build request models**

Create `src/codealmanac/workflows/build/requests.py`:

```python
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.runs.models import RunId


class RunBuildRequest(CodeAlmanacModel):
    cwd: Path
    harness: HarnessKind
    wiki: str | None = None
    name: str | None = None
    description: str = ""
    title: str | None = None
    guidance: str | None = None
    force: bool = False
    auto_commit: bool = True

    @field_validator("name", "description", "title", "guidance")
    @classmethod
    def require_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "build request text")


class RunBuildWithRunRequest(RunBuildRequest):
    run_id: RunId
```

**Step 2: Add build result and payload models**

Update `src/codealmanac/workflows/build/models.py`:

```python
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.index.models import IndexRefreshResult
from codealmanac.services.runs.models import RunRecord
from codealmanac.services.workspaces.models import Workspace
from codealmanac.workflows.lifecycle import LifecycleMutationReport
from codealmanac.workflows.lifecycle_commit import LifecycleCommitPolicy


class BuildPromptPayload(CodeAlmanacModel):
    workspace_name: str
    workspace_root: Path
    almanac_root: Path
    source_control: LifecycleCommitPolicy
    guidance: str | None = None


class BuildResult(CodeAlmanacModel):
    workspace: Workspace
    run: RunRecord
    harness: HarnessRunResult
    safety: LifecycleMutationReport
    index: IndexRefreshResult
```

**Step 3: Wire build workflow like ingest/garden**

`BuildWorkflow` receives:

```python
workspaces: WorkspacesService
wiki: WikiService
index: IndexService
runs: RunsService
page_runs: PageRunWorkflow
prompts: PromptRenderer
```

`BuildWorkflow.run(request)` performs:

1. resolve/register/scaffold `almanac/` through existing workspace/wiki services;
2. reject populated wiki unless `request.force` is true;
3. start run with `operation=RunOperation.BUILD`;
4. preflight allowed mutations under the configured `almanac/`;
5. render prompt from base `kernel`, operation `build`, and runtime context;
6. run harness in repo root;
7. validate changed files stay under `almanac/`;
8. validate harness success;
9. refresh index;
10. run health validation;
11. finish run.

**Step 4: Render build prompt from Kushagra's kernel plus build prompt**

Use:

```python
BUILD_PROMPT_SECTIONS = (
    PromptName.BASE_KERNEL,
    PromptName.OPERATION_BUILD,
)
```

The runtime context includes:

```text
Runtime context:
{
  "workspace_name": "...",
  "workspace_root": "...",
  "almanac_root": ".../almanac",
  "source_control": {...},
  "guidance": "..."
}
```

**Step 5: Keep deterministic scaffold as a private helper**

The deterministic scaffold remains inside workspace/wiki initialization. It is not called `build`, not rendered as a build result, and not exposed as a lifecycle operation.

**Step 6: Add build workflow tests**

Tests in `tests/test_build_workflow.py`:

- `test_init_runs_model_backed_build_operation`
- `test_build_prompt_uses_kushagra_build_prompt`
- `test_build_rejects_populated_wiki_without_force`
- `test_build_force_allows_existing_wiki`
- `test_build_records_run_operation_build`
- `test_build_rejects_harness_mutation_outside_almanac`
- `test_build_refreshes_index_after_harness_writes_pages`
- `test_build_respects_auto_commit_policy`

Use a fake harness that writes:

```markdown
---
title: Getting Started
topics: [getting-started]
sources:
  - type: file
    path: pyproject.toml
---
# Getting Started

This wiki starts with the Python package metadata.
```

to `almanac/getting-started.md`.

**Step 7: Run focused tests**

```bash
uv run pytest tests/test_build_workflow.py tests/test_cli.py -q
uv run ruff check src/codealmanac/workflows/build src/codealmanac/app.py tests/test_build_workflow.py
```

Expected: pass.

**Step 8: Commit**

```bash
git add src/codealmanac/workflows/build src/codealmanac/workflows/page_run src/codealmanac/workflows/lifecycle_mutation.py src/codealmanac/app.py tests/test_build_workflow.py tests/test_cli.py
git commit -m "feat: implement model backed build operation"
```

---

## Task 6: Add Build To Queue And Worker

**Files:**
- Modify: `src/codealmanac/workflows/run_queue/service.py`
- Modify: `src/codealmanac/workflows/run_queue/models.py`
- Modify: `src/codealmanac/services/runs/models.py`
- Modify: `src/codealmanac/cli/dispatch/worker.py`
- Modify: `tests/test_run_queue_workflow.py`

**Step 1: Allow queued build specs**

`RunSpec` already accepts `RunOperation.BUILD` after Task 3. Add queue methods:

```python
def queue_build(self, request: RunBuildRequest) -> RunRecord:
    return self.runs.queue(
        QueueRunRequest(
            cwd=request.cwd,
            wiki=request.wiki,
            title=request.title or "Build wiki",
            spec=RunSpec(
                operation=RunOperation.BUILD,
                cwd=request.cwd,
                wiki=request.wiki,
                harness=request.harness,
                title=request.title,
                guidance=request.guidance,
                auto_commit=request.auto_commit,
            ),
        )
    )
```

Add:

```python
def start_build_background(self, request: RunBuildRequest) -> RunQueueStartResult:
    run = self.queue_build(request)
    worker = self.spawn_worker(request.cwd, request.wiki)
    return RunQueueStartResult(run=run, worker=worker)
```

**Step 2: Drain build specs**

In `run_one`, add:

```python
if spec.operation == RunOperation.BUILD:
    result = self.build.run_with_run(
        RunBuildWithRunRequest(
            cwd=spec.cwd,
            wiki=spec.wiki,
            harness=spec.harness,
            title=spec.title,
            guidance=spec.guidance,
            auto_commit=spec.auto_commit,
            run_id=queued.record.run_id,
        )
    )
    return result.run
```

**Step 3: Construct queue with build workflow**

Update `CodeAlmanacWorkflows.queue` construction in `src/codealmanac/app.py` so `RunQueueWorkflow` receives `build`, `ingest`, and `garden`.

**Step 4: Test queued build**

Add tests:

- background init queues operation `build`;
- worker drains queued build;
- queued build writes `almanac/getting-started.md`;
- queued build records operation `build`.

**Step 5: Run focused tests**

```bash
uv run pytest tests/test_run_queue_workflow.py tests/test_build_workflow.py tests/test_cli.py -q
```

Expected: pass.

**Step 6: Commit**

```bash
git add src/codealmanac/workflows/run_queue src/codealmanac/services/runs/models.py src/codealmanac/cli/dispatch/worker.py src/codealmanac/app.py tests/test_run_queue_workflow.py
git commit -m "feat: queue build operation"
```

---

## Task 7: Clean Sync Into Transcript Intake Only

**Files:**
- Modify: `src/codealmanac/workflows/sync/service.py`
- Modify: `src/codealmanac/workflows/sync/execution.py`
- Modify: `src/codealmanac/workflows/sync/models.py`
- Modify: `src/codealmanac/cli/parser/lifecycle.py`
- Modify: `src/codealmanac/cli/dispatch/sync.py`
- Modify: `src/codealmanac/cli/render/lifecycle.py`
- Modify: `tests/test_sync_workflow.py`
- Modify: `tests/test_cli.py`

**Step 1: Rename sync language in code comments and render copy**

Use "transcript intake" for sync descriptions:

```text
sync quiet local transcripts into ingest runs
```

Do not call sync a lifecycle operation in help text, renderer text, tests, or docs.

**Step 2: Keep sync execution creating ingest requests**

`sync_ingest_request` remains the only run-producing path:

```python
return RunIngestRequest(
    cwd=item.candidate.repo_root,
    inputs=(f"transcript:{item.candidate.transcript_path}",),
    harness=request.harness,
    wiki=request.wiki,
    title=sync_ingest_title(item.candidate),
    guidance=sync_ingest_guidance(item),
    auto_commit=request.auto_commit,
)
```

**Step 3: Add tests that sync never records operation sync**

Test:

```python
runs = app.runs.list(ListRunsRequest(cwd=repo))
assert all(run.operation == RunOperation.INGEST for run in runs)
```

**Step 4: Run focused tests**

```bash
uv run pytest tests/test_sync_workflow.py tests/test_cli.py -q
uv run ruff check src/codealmanac/workflows/sync src/codealmanac/cli tests/test_sync_workflow.py
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/codealmanac/workflows/sync src/codealmanac/cli tests/test_sync_workflow.py tests/test_cli.py
git commit -m "refactor: make sync transcript intake only"
```

---

## Task 8: Clean Automation Naming Around Tasks, Not Operations

**Files:**
- Modify: `src/codealmanac/services/automation/models.py`
- Modify: `src/codealmanac/services/automation/definitions.py`
- Modify: `src/codealmanac/services/automation/jobs.py`
- Modify: `src/codealmanac/services/automation/service.py`
- Modify: `src/codealmanac/services/setup/planning.py`
- Modify: `src/codealmanac/cli/render/setup.py`
- Modify: `tests/test_automation_service.py`
- Modify: `tests/test_setup_service.py`
- Modify: `tests/test_cli.py`

**Step 1: Keep automation values as scheduled tasks**

Scheduled task values remain:

```text
sync
garden
update
```

Meaning:

- `sync` scheduled task runs transcript intake and creates `ingest` operations;
- `garden` scheduled task creates `garden` operations;
- `update` scheduled task updates the product and creates no wiki operation.

**Step 2: Rename user copy**

Setup screen copy:

```text
How should your wikis be updated?
```

Automatic side:

```text
sync agent sessions
garden wiki structure
```

Manual side:

```text
run them yourself
no wiki schedules
```

Product update screen:

```text
Keep CodeAlmanac itself up to date?
```

Automatic side:

```text
install product updater
new versions arrive automatically
```

Manual side:

```text
update yourself
no product update schedule
```

Do not use "operation" in setup copy for scheduled tasks.

**Step 3: Add tests**

Tests assert:

- setup output contains "sync agent sessions";
- setup output contains "garden wiki structure";
- setup output does not say "initialized";
- setup output does not call sync an operation;
- automation job for `sync` runs `codealmanac sync`;
- automation job for `garden` runs `codealmanac garden`;
- automation job for `update` runs `codealmanac update --scheduled`.

**Step 4: Run focused tests**

```bash
uv run pytest tests/test_automation_service.py tests/test_setup_service.py tests/test_cli.py -q
uv run ruff check src/codealmanac/services/automation src/codealmanac/services/setup src/codealmanac/cli/render/setup.py
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/codealmanac/services/automation src/codealmanac/services/setup src/codealmanac/cli/render/setup.py tests/test_automation_service.py tests/test_setup_service.py tests/test_cli.py
git commit -m "fix: separate scheduled tasks from wiki operations"
```

---

## Task 9: Update AGENTS Guide And Installed Instructions

**Files:**
- Modify: `src/codealmanac/services/setup/agent-guide.md`
- Modify: `src/codealmanac/integrations/setup/guide.py`
- Modify: `tests/test_setup_service.py`
- Modify: `tests/test_public_contract.py`

**Step 1: Rewrite operation model in guide**

The guide says:

```markdown
CodeAlmanac has three internal wiki operations:

- `build`: first substantial wiki construction, started by `codealmanac init`
- `ingest`: update the wiki from explicit sources or synced agent transcripts
- `garden`: maintain structure, topics, links, stale claims, and page boundaries

`sync` is transcript intake. It scans quiet agent sessions and starts `ingest`
runs. `update` is product maintenance. Neither is a wiki operation.
```

**Step 2: Update commands in guide**

Normal agent commands:

```bash
codealmanac search "<query>"
codealmanac show <page-path>
codealmanac topics
codealmanac health
```

Lifecycle commands:

```bash
codealmanac init
codealmanac ingest <source...>
codealmanac garden
```

Transcript intake:

```bash
codealmanac sync
codealmanac sync status
```

No `capture`. No `absorb`. No `almanac` binary in installed guide.

**Step 3: Test installed guide**

Tests assert the rendered guide:

- includes the three operation bullets;
- includes `codealmanac init`;
- includes `sync is transcript intake`;
- excludes `capture`;
- excludes `absorb`;
- excludes `.almanac/pages`;
- excludes `files:`.

**Step 4: Run focused tests**

```bash
uv run pytest tests/test_setup_service.py tests/test_public_contract.py -q
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/codealmanac/services/setup/agent-guide.md src/codealmanac/integrations/setup/guide.py tests/test_setup_service.py tests/test_public_contract.py
git commit -m "docs: install correct agent operation guide"
```

---

## Task 10: Update README, Concepts, And Public Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/concepts.md`
- Modify: `CONTRIBUTING.md`
- Modify: `tests/test_public_contract.py`

**Step 1: Public docs command model**

Docs state:

```markdown
`codealmanac init` builds the first wiki for a repo. Internally that run is
recorded as operation `build`.

The only internal wiki operations are `build`, `ingest`, and `garden`.
```

**Step 2: Public docs sync model**

Docs state:

```markdown
`codealmanac sync` scans quiet local agent transcripts and starts ordinary
`ingest` runs. Sync is intake, not an operation.
```

**Step 3: Public docs setup model**

Docs state:

```markdown
`codealmanac setup` is machine-level onboarding. It installs agent instructions,
scheduled wiki maintenance, product updates, and commit policy instructions.
It does not initialize a repo. Run `codealmanac init` inside a repo.
```

**Step 4: Update public contract fragments**

Required fragments include:

- "Internal wiki operations: `build`, `ingest`, `garden`"
- "`codealmanac init` starts the build operation"
- "`codealmanac sync` starts ingest runs"

Forbidden fragments include:

- "`codealmanac build`"
- "almanac capture"
- "absorb"
- ".almanac/pages"
- "files:"

**Step 5: Run docs tests**

```bash
uv run pytest tests/test_public_contract.py -q
rg -n "codealmanac build|almanac capture|\\babsorb\\b|\\.almanac/pages|files:" README.md docs src/codealmanac/manual src/codealmanac/services/setup/agent-guide.md
```

Expected:
- pytest passes;
- grep returns only approved explicit migration-history references.

**Step 6: Commit**

```bash
git add README.md docs/concepts.md CONTRIBUTING.md tests/test_public_contract.py
git commit -m "docs: document init as build operation"
```

---

## Task 11: End-To-End Smoke Tests

**Files:**
- Modify: `tests/test_cli.py`
- Modify: `tests/test_build_workflow.py`
- Modify: `tests/test_sync_workflow.py`

**Step 1: Add CLI smoke for init/build**

Test script:

```python
result = run_cli(("init", str(repo), "--using", "codex"))
assert result.exit_code == 0
runs = app.runs.list(ListRunsRequest(cwd=repo))
assert runs[0].operation == RunOperation.BUILD
assert (repo / "almanac/getting-started.md").is_file()
```

**Step 2: Add CLI smoke for sync/ingest**

Test script:

```python
result = run_cli(("sync", "--foreground", "--using", "codex"))
assert result.exit_code == 0
runs = app.runs.list(ListRunsRequest(cwd=repo))
assert all(run.operation == RunOperation.INGEST for run in runs)
```

**Step 3: Add CLI smoke for setup next step**

Setup final panel says:

```text
Navigate to your repo of choice
codealmanac init
```

It does not list `codealmanac build`.

**Step 4: Run full tests**

```bash
uv run pytest -q
uv run ruff check .
git diff --check
```

Expected:
- full pytest passes;
- ruff passes;
- whitespace check passes.

**Step 5: Commit**

```bash
git add tests/test_cli.py tests/test_build_workflow.py tests/test_sync_workflow.py
git commit -m "test: cover operation architecture end to end"
```

---

## Task 12: Manual Product Feel Check

**Files:**
- No source changes after this task except fixes discovered by smoke commands.

**Step 1: Clean setup smoke**

Run:

```bash
tmp_home=$(mktemp -d)
HOME="$tmp_home" uv run codealmanac setup --target codex --sync-off --garden-off --no-auto-update --yes
```

Expected output:

- figlet banner appears;
- tagline says "The self-updating wiki for your coding agents";
- no `initialized` wording;
- no `build` command in next steps;
- next steps include only:

```text
cd /path/to/your/repo
codealmanac init
```

**Step 2: Clean init smoke**

Run:

```bash
tmp_home=$(mktemp -d)
tmp_repo=$(mktemp -d)
cd "$tmp_repo"
git init
printf '[project]\nname = "sample"\n' > pyproject.toml
HOME="$tmp_home" uv run --directory /Users/rohan/Desktop/Projects/codealmanac codealmanac init --using codex --foreground
```

Expected:

- a run is recorded as operation `build`;
- generated wiki files live under `almanac/`;
- no runtime files appear under committed `almanac/`;
- `codealmanac search getting` returns a result.

**Step 3: Clean sync smoke**

Run a test with fake transcript fixtures through pytest, not real user transcripts:

```bash
uv run pytest tests/test_sync_workflow.py -q
```

Expected:

- sync starts ingest runs;
- no sync operation record exists.

**Step 4: Final grep**

Run:

```bash
rg -n "RunOperation\\.SYNC|operation: sync|operation=RunOperation\\.SYNC|codealmanac build|almanac capture|\\babsorb\\b|\\.almanac/pages|files:" src tests README.md docs notes.md implementation-tickets.md
```

Expected:
- no live product hits;
- explicit historical docs are outside this grep scope.

**Step 5: Final commit**

Commit any smoke fixes:

```bash
git add .
git commit -m "fix: align smoke behavior with three operations"
```

---

## Final Verification Gate

Run:

```bash
uv run pytest -q
uv run ruff check .
git diff --check
uv build --out-dir dist
uvx twine check dist/*
```

Expected:

- pytest passes;
- ruff passes;
- diff check passes;
- package build passes;
- twine check passes.

Then run:

```bash
git log --oneline -12
git status --short --branch
```

Expected:

- task commits appear in order;
- working tree is clean.

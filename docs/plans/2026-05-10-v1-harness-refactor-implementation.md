# V1 Harness Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild CodeAlmanac's AI execution path around Build, Absorb, Garden, a provider-neutral harness SDK, and a per-wiki process/job manager.

**Architecture:** This is a deliberate breaking refactor. Do not preserve the current `bootstrap` / `writer` / hardcoded reviewer pipeline unless a piece directly fits the new architecture. Build the correct structure first: operation layer -> `AgentRunSpec` -> process manager -> harness SDK -> provider adapter -> normalized events -> wiki snapshots/reindex.

**Tech Stack:** TypeScript, Commander, Vitest, Node child processes, filesystem JSONL logs, existing SQLite indexer, Claude Agent SDK, Codex CLI/app-server/SDK adapter exploration.

---

## Read Before Coding

Read these files first, in this order:

1. `AGENTS.md`
2. `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md`
3. `docs/plans/2026-05-08-wiki-agent-operations-and-cli-design.md`
4. `docs/plans/2026-05-10-harness-process-architecture.md`
5. `docs/research/2026-05-09-claude-harness-capabilities.md`
6. `docs/research/2026-05-09-codex-harness-capabilities.md`
7. OpenAlmanac GUI provider references:
   - `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/service.js`
   - `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/claude-adapter.js`
   - `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/codex-adapter.js`
   - `/Users/rohan/Desktop/Projects/openalmanac/gui/shared/providers/runtime-events.d.ts`
   - `/Users/rohan/Desktop/Projects/openalmanac/gui/src/domains/providers/models.ts`

## Operating Rules For This Refactor

- This branch is allowed to break the old architecture.
- Prefer deleting stale abstractions over adapting them awkwardly.
- Do not create a source/evidence pipeline.
- Do not recreate the hardcoded writer/reviewer capture architecture.
- Prompts use a small shared base (`prompts/base/purpose.md`,
  `notability.md`, `syntax.md`) plus `prompts/operations/build.md`,
  `absorb.md`, `garden.md`, and empty `prompts/agents/.gitkeep`.
- Prompt assembly is simple string joining with `loadPrompt()` and `joinPrompts()`.
- All write-capable AI commands create CodeAlmanac jobs.
- `init` defaults foreground; `capture`, `ingest`, and `garden` default background.
- `.almanac/runs/` is the only run/log directory and must be gitignored.
- Commit and push after each coherent task or phase.
- Keep `npm test` green at every commit unless a commit message explicitly states a temporary failing checkpoint. Prefer not to make failing commits.

## Required Logs

Maintain these files throughout implementation:

- `docs/plans/2026-05-10-v1-implementation-log.md`
- `docs/plans/2026-05-10-v1-decision-log.md`

Update the implementation log after each task:

```text
YYYY-MM-DD HH:MM PT
- Built:
- Files changed:
- Tests run:
- Result:
- Next:
```

Update the decision log whenever a design choice changes or a tradeoff is made:

```text
YYYY-MM-DD HH:MM PT
Decision:
Context:
Alternatives:
Why:
Consequences:
```

## Commit / Push Cadence

Use small commits:

```bash
git add <files>
git commit -m "<type>(v1): <summary>"
git push
```

Recommended commit types:

```text
docs(v1): ...
feat(v1): ...
refactor(v1): ...
test(v1): ...
fix(v1): ...
```

After each substantial phase, dispatch a review agent. The review should check
for architecture drift against `2026-05-10-harness-process-architecture.md`,
not just local code style.

## Target Directory Shape

New or refactored directories:

```text
src/harness/
  types.ts
  events.ts
  tools.ts
  prompts.ts
  index.ts
  providers/
    index.ts
    claude.ts
    codex.ts
    cursor.ts

src/process/
  types.ts
  ids.ts
  records.ts
  logs.ts
  snapshots.ts
  manager.ts

src/operations/
  build.ts
  absorb.ts
  garden.ts
  prompt-context.ts

src/commands/jobs.ts
src/commands/init.ts
src/commands/capture.ts
src/commands/ingest.ts
src/commands/garden.ts

prompts/
  operations/
    build.md
    absorb.md
    garden.md
  agents/
    .gitkeep
```

The exact filenames can change if implementation proves a better split, but the
boundaries should remain.

## Phase 1: Prompt System Reset

### Task 1.1: Replace Flat Prompts With Base And Operation Prompts

**Files:**
- Create: `prompts/base/purpose.md`
- Create: `prompts/base/notability.md`
- Create: `prompts/base/syntax.md`
- Create: `prompts/operations/build.md`
- Create: `prompts/operations/absorb.md`
- Create: `prompts/operations/garden.md`
- Create: `prompts/agents/.gitkeep`
- Keep temporarily if needed: `prompts/bootstrap.md`, `prompts/writer.md`, `prompts/reviewer.md`
- Modify: `package.json` only if needed; `prompts` is already included.
- Update log: `docs/plans/2026-05-10-v1-implementation-log.md`

**Steps:**
1. Create the base and operation prompt files.
2. `purpose.md`: cultivated project memory, deep-research cache,
   project-world map, inputs as raw material, synthesis over logs.
3. `notability.md`: page existence, entities, dependencies, influences,
   research/product/market synthesis, topics, clusters, hubs, temporal pages,
   splitting, merging, archiving, and supersession.
4. `syntax.md`: frontmatter, source grounding, natural slugs, wikilinks,
   topic tagging, lead-first page shape, citations, and anti-patterns.
5. `build.md`: deep first construction pass, corpus exploration, substantial
   initial wiki, optional bounded helper/subagent investigations.
6. `absorb.md`: improve wiki from starting context, input is not output,
   prefer evolving synthesis pages, no-op valid.
7. `garden.md`: improve whole wiki graph, merge/split/archive/relink/retopic,
   cultivate clusters and hubs, avoid churn.
8. Leave `prompts/agents/` empty except `.gitkeep`.
9. Run targeted operation prompt tests.
10. Record result in implementation log.
11. Commit and push.

### Task 1.2: Add Path-Based Prompt Loader And Join Helper

**Files:**
- Modify: `src/agent/prompts.ts` or move to `src/harness/prompts.ts`
- Test: add/update prompt loader tests near existing prompt tests
- Update logs

**Steps:**
1. Support prompt names with slash paths, e.g. `operations/build`.
2. Reject paths that escape `prompts/`.
3. Add `joinPrompts(parts: Array<string | undefined | null>): string`.
4. Join with clear separators, not a complex manifest.
5. Keep compatibility for old prompt names only if needed during transition.
6. Add tests for:
   - `loadPrompt("base/purpose")`
   - `loadPrompt("operations/build")`
   - nested prompt path traversal rejection
   - `joinPrompts` skips empty parts
7. Run targeted tests.
8. Commit and push.

## Phase 2: Harness SDK Core

### Task 2.1: Define Provider-Neutral Harness Types

**Files:**
- Create: `src/harness/types.ts`
- Create: `src/harness/events.ts`
- Create: `src/harness/tools.ts`
- Modify or retire: `src/agent/types.ts`
- Tests: `test/harness-types.test.ts` if useful for pure helpers
- Update logs

**Core types:**

```ts
export interface AgentRunSpec {
  provider: {
    id: "claude" | "codex" | "cursor";
    model?: string;
    effort?: string;
  };
  cwd: string;
  systemPrompt?: string;
  prompt: string;
  tools?: ToolRequest[];
  agents?: Record<string, AgentSpec>;
  skills?: string[];
  mcpServers?: Record<string, unknown>;
  limits?: {
    maxTurns?: number;
    maxCostUsd?: number;
  };
  output?: {
    schemaPath?: string;
  };
  metadata?: {
    operation: "build" | "absorb" | "garden";
    targetKind?: string;
    targetPaths?: string[];
  };
}
```

**Steps:**
1. Define `ToolRequest` base tools: `read`, `write`, `edit`, `search`, `shell`, `web`, `mcp`.
2. Define `AgentSpec` without any reviewer/scout-specific logic.
3. Define `HarnessEvent`: `text_delta`, `text`, `tool_use`, `tool_result`, `tool_summary`, `context_usage`, `error`, `done`.
4. Define `HarnessCapabilities`.
5. Do not import Claude SDK types in provider-neutral files.
6. Commit and push.

### Task 2.2: Build Harness Provider Registry

**Files:**
- Create: `src/harness/providers/index.ts`
- Create: `src/harness/index.ts`
- Modify: existing `src/agent/providers/*` only as migration path
- Tests: provider registry tests
- Update logs

**Steps:**
1. Create an adapter interface:
   ```ts
   interface HarnessProvider {
     metadata: ProviderMetadata;
     checkStatus(): Promise<ProviderStatus>;
     run(spec: AgentRunSpec, hooks: HarnessRunHooks): Promise<HarnessResult>;
   }
   ```
2. Add `getHarnessProvider(id)`.
3. Add provider metadata and capabilities.
4. Keep provider quirks inside provider adapters.
5. Commit and push.

## Phase 3: Process Manager

### Task 3.1: Add Run Records And IDs

**Files:**
- Create: `src/process/types.ts`
- Create: `src/process/ids.ts`
- Create: `src/process/records.ts`
- Test: `test/process-records.test.ts`
- Update logs

**Steps:**
1. Generate stable run ids like `run_<timestamp>_<short-random>` or equivalent.
2. Store run records in `.almanac/runs/<run-id>.json`.
3. Store event logs in `.almanac/runs/<run-id>.jsonl`.
4. Implement atomic record writes.
5. Implement stale detection by PID.
6. Test read/write/list/status transitions.
7. Commit and push.

### Task 3.2: Add Snapshot And Delta Accounting

**Files:**
- Create: `src/process/snapshots.ts`
- Reuse/refactor from: `src/commands/capture.ts`
- Test: `test/process-snapshots.test.ts`
- Update logs

**Steps:**
1. Snapshot `.almanac/pages/*.md` by slug/hash/archive state.
2. Compute created/updated/archived counts.
3. Ignore non-markdown files.
4. Keep this deterministic and provider-free.
5. Commit and push.

### Task 3.3: Implement Process Manager Start Path

**Files:**
- Create: `src/process/manager.ts`
- Create: `src/process/logs.ts`
- Tests: `test/process-manager.test.ts`
- Update logs

**Steps:**
1. Implement foreground execution first.
2. Manager creates run record, snapshots before, calls harness, records events, snapshots after, reindexes, writes final record.
3. Add injectable fake harness for tests.
4. Add tests for success, failure, no-op delta, event log writing.
5. Commit and push.

### Task 3.4: Add Background Job Execution

**Files:**
- Modify: `src/process/manager.ts`
- Create if needed: `src/process/child-entry.ts`
- Modify: `bin/codealmanac.ts` or CLI dispatch to support internal job execution
- Tests: focused process/background tests where feasible
- Update logs

**Steps:**
1. Add detached background launch.
2. Background child should rehydrate `AgentRunSpec` from run record or a temp spec file under `.almanac/runs/`.
3. Parent exits after writing `started` record and printing run id.
4. Child owns actual harness run.
5. Ensure `CODEALMANAC_INTERNAL_SESSION=1` to avoid recursive hooks.
6. Commit and push.

## Phase 4: Provider Adapters

### Task 4.1: Port Claude To Harness Adapter

**Files:**
- Create: `src/harness/providers/claude.ts`
- Retire or adapt: `src/agent/providers/claude/index.ts`
- Tests: Claude adapter tests with fake SDK/query where possible
- Update decision log for permission/tool choices

**Steps:**
1. Map `AgentRunSpec` to Claude Agent SDK query options.
2. Map base tools to Claude native tools.
3. Keep `agents` generic; do not hardcode reviewer.
4. Normalize Claude stream to `HarnessEvent`.
5. Capture cost, turns, session id, usage when exposed.
6. Add status/auth check equivalent to current behavior.
7. Commit and push.

### Task 4.2: Choose Codex Transport And Port Adapter

**Files:**
- Create: `src/harness/providers/codex.ts`
- Reference: OpenAlmanac GUI Codex adapter and `docs/research/2026-05-09-codex-harness-capabilities.md`
- Tests: Codex adapter tests with fake process/app-server
- Update decision log with chosen transport

**Steps:**
1. Decide between `codex exec --json`, Codex app-server, or Codex SDK based on current local capability and implementation cost.
2. Keep the choice adapter-internal.
3. Map `AgentRunSpec` to chosen Codex transport.
4. Normalize events to `HarnessEvent`.
5. Preserve usage/context usage when available.
6. Do not claim programmatic per-run subagents unless implemented and tested.
7. Commit and push.

### Task 4.3: Cursor Placeholder Or Adapter

**Files:**
- Create/modify: `src/harness/providers/cursor.ts`
- Tests: status and unsupported behavior
- Update logs

**Steps:**
1. Either port the current Cursor CLI adapter or create an explicit unsupported/low-fidelity adapter behind capabilities.
2. Do not block the refactor on Cursor if Claude/Codex are the priority.
3. Commit and push.

## Phase 5: Operations

### Task 5.1: Build Operation

**Files:**
- Create: `src/operations/build.ts`
- Modify: `src/commands/init.ts` if command remains there
- Tests: `test/build-operation.test.ts`
- Update logs

**Steps:**
1. Resolve repo root and `.almanac/`.
2. Init `.almanac/` structure if missing.
3. Build prompt from `prompts/operations/build.md` plus runtime context strings.
4. Construct `AgentRunSpec` with metadata `{ operation: "build", targetKind: "repo" }`.
5. Route through process manager.
6. Default foreground.
7. Commit and push.

### Task 5.2: Absorb Operation

**Files:**
- Create: `src/operations/absorb.ts`
- Modify/create: `src/commands/capture.ts`, `src/commands/ingest.ts`
- Tests: `test/absorb-operation.test.ts`
- Update logs

**Steps:**
1. Implement one internal Absorb operation.
2. `capture` prepares transcript/session runtime strings and calls Absorb.
3. `ingest` prepares file/folder runtime strings and calls Absorb.
4. Do not create a separate source/evidence layer.
5. Default background.
6. Commit and push.

### Task 5.3: Garden Operation

**Files:**
- Create: `src/operations/garden.ts`
- Create: `src/commands/garden.ts`
- Tests: `test/garden-operation.test.ts`
- Update logs

**Steps:**
1. Build prompt from `prompts/operations/garden.md`.
2. Include repo root and `.almanac/` path as runtime text.
3. Construct `AgentRunSpec` with metadata `{ operation: "garden", targetKind: "wiki" }`.
4. Route through process manager.
5. Default background.
6. Commit and push.

## Phase 6: CLI Surface

### Task 6.1: Register New Commands And Flags

**Files:**
- Modify: `src/cli/register-wiki-lifecycle-commands.ts`
- Modify: `src/cli/register-commands.ts`
- Create: `src/commands/jobs.ts`
- Tests: CLI command tests
- Update logs

**Commands:**

```bash
almanac init [--using <provider[/model]>] [--background] [--json] [--force] [--yes]
almanac capture [session-file...] [--app <app>] [--session <id>] [--since <duration-or-date>] [--limit <n>] [--all] [--all-apps] [--using <provider[/model]>] [--foreground] [--json] [--yes]
almanac ingest <file-or-folder> [--using <provider[/model]>] [--foreground] [--json] [--yes]
almanac garden [--using <provider[/model]>] [--foreground] [--json] [--yes]
almanac jobs [--json]
almanac jobs show <run-id> [--json]
almanac jobs attach <run-id>
almanac jobs logs <run-id>
almanac jobs cancel <run-id>
```

**Steps:**
1. Implement shared `--using` parser.
2. Replace `--agent` / `--model` in public docs; keep aliases only if needed during migration.
3. Enforce `--json` cannot combine with `--foreground`.
4. Ensure command defaults:
   - `init`: foreground
   - `capture`: background
   - `ingest`: background
   - `garden`: background
5. Commit and push.

### Task 6.2: Jobs Commands

**Files:**
- Create/modify: `src/commands/jobs.ts`
- Tests: `test/jobs-command.test.ts`
- Update logs

**Steps:**
1. `jobs` lists per-wiki runs from `.almanac/runs/`.
2. `jobs show` prints one run record.
3. `jobs logs` prints JSONL or human-readable log.
4. `jobs attach` tails the event log.
5. `jobs cancel` interrupts/kills if possible and marks record.
6. Commit and push.

## Phase 7: Gitignore And Wiki Init

### Task 7.1: Ensure Generated Ignore Rules

**Files:**
- Modify: init/wiki setup code
- Tests: init helper tests
- Update logs

**Rules:**

```gitignore
.almanac/index.db
.almanac/runs/
```

**Steps:**
1. Ensure new wikis ignore runs and index.
2. Do not add `.almanac/logs/`.
3. Add tests for generated ignore behavior.
4. Commit and push.

## Phase 8: Remove Old Architecture

### Task 8.1: Delete Or Retire Old Capture/Bootstrap Pipeline

**Files:**
- Remove/replace old hardcoded reviewer code in `src/commands/capture.ts`
- Remove/replace old `src/commands/bootstrap.ts` usage
- Remove old prompt names once tests are migrated
- Update tests
- Update logs and decision log

**Steps:**
1. Delete old writer/reviewer-specific capture flow.
2. Replace bootstrap path with Build operation.
3. Preserve command compatibility only where explicitly chosen.
4. Remove stale tests that assert old architecture details.
5. Commit and push.

## Phase 9: Full Verification And Review

### Task 9.1: Full Test Pass

**Files:**
- Any final fixes
- Update logs

**Steps:**
1. Run `npm test`.
2. Run `npm run lint`.
3. Fix failures.
4. Commit and push.

### Task 9.2: Review Agent

**Steps:**
1. Spawn a review agent with this scope:
   - read `2026-05-10-harness-process-architecture.md`
   - read this implementation plan
   - inspect final diff against `main`
   - look for architecture drift, missing tests, stale old pipeline pieces, prompt over-abstraction, jobs/logs inconsistency
2. Apply must-fix findings.
3. Commit and push.

### Task 9.3: Final Branch State

**Steps:**
1. Ensure branch is pushed.
2. Ensure implementation and decision logs are current.
3. Summarize:
   - commits
   - tests
   - remaining risks
   - follow-up tasks

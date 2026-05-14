# Provider and Automation Boundary Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make provider, automation, capture sweep, operation, and run boundaries explicit so future scheduled work and provider changes do not accumulate command-level special cases.

**Architecture:** Keep existing behavior, but move responsibilities to lifecycle-oriented modules. Automation schedules known Almanac tasks; tasks may start runs; runs execute operations; harness providers execute `AgentRunSpec`s; agent readiness projects provider status plus config for setup, agents, and doctor commands.

**Tech Stack:** TypeScript, Commander CLI, Vitest, macOS launchd plist generation, repo-local `.almanac/runs/` process records.

---

## Context

The current scheduler and provider code works, but several boundaries are overloaded:

- `src/commands/automation.ts` owns launchd mechanics, capture scheduling, Garden scheduling, legacy hook cleanup, setup-specific command path handling, status formatting, and XML plist rendering.
- `src/commands/capture-sweep.ts` owns transcript discovery, repo mapping, quiet-window filtering, ledger cursor logic, repo locks, Absorb enqueueing, and summary rendering.
- `src/agent/providers/` still looks like an execution provider layer even though actual operation execution now goes through `src/harness/providers/`.
- `src/update/config.ts` now owns global config, agent defaults, model settings, automation activation state, and update-notifier state despite its narrow filename.

The refactor should preserve the existing product contract:

- Automation is scheduler-backed.
- `capture sweep` is not an Operation; it is a coordinator task that may start zero or more Absorb runs.
- Build, Absorb, and Garden remain the semantic wiki Operations.
- A Run remains one process-manager execution of one Operation.
- The scheduler should wake known Almanac tasks, not arbitrary shell strings.

## Terminology

Use these terms consistently in code and docs:

- **Operation:** semantic AI wiki mutation mode: Build, Absorb, Garden.
- **Run:** one process-manager execution of an Operation, with run id, status, log, provider, and normalized events.
- **Scheduled task:** a known Almanac command the OS scheduler can invoke on a cadence.
- **Coordinator:** a command/task that decides whether to start one or more Runs.
- **Sweep:** the capture coordinator that discovers quiet external transcripts and starts Absorb Runs.

The dependency model is:

```text
Automation schedules ScheduledTasks.
ScheduledTasks invoke CLI commands.
CLI commands may act as Coordinators.
Coordinators may start Runs.
Runs execute Operations through harness providers.
```

## Target Module Shape

```text
src/config/
  index.ts                 # read/write global config, schema
  keys.ts                  # config CLI key parsing
  agent.ts                 # agent.default and agent.models helpers
  automation.ts            # automation.capture_since helpers

src/harness/providers/
  index.ts
  metadata.ts
  claude.ts
  codex.ts
  cursor.ts                # runtime execution adapters only

src/agent/
  readiness.ts             # setup/agents/doctor provider view
  fixes.ts                 # login/install fix text
  catalog.ts               # only if shared provider facts are not fully covered by harness metadata

src/capture/
  discovery/
    types.ts
    claude.ts
    codex.ts
    index.ts
  ledger.ts
  lock.ts
  sweep.ts                 # scan/filter/map/reconcile/enqueue pipeline

src/automation/
  scheduled-task.ts        # ScheduledTaskDefinition types
  tasks.ts                 # capture-sweep and garden task definitions
  launchd.ts               # plist render/read/bootstrap/bootout
  legacy-hooks.ts          # migration cleanup for old provider hooks

src/commands/
  automation.ts            # CLI wrapper over src/automation
  capture-sweep.ts         # CLI wrapper over src/capture/sweep
  setup.ts                 # onboarding workflow
  agents.ts                # agent config/status CLI
  operations.ts            # command -> operation bridge
```

Do not create every target file in the first commit if a smaller extraction is clearer. The final shape should be visible after the sequence lands.

## Non-Goals

- Do not change public command names.
- Do not add arbitrary user-defined scheduled shell commands.
- Do not remove `capture sweep`.
- Do not change launchd plist paths.
- Do not change default intervals: capture `5h`, quiet `45m`, Garden `2d`.
- Do not change ledger file path or JSON format unless a migration is explicitly added.
- Do not rewrite process-manager run records.
- Do not import t3code’s Effect driver/instance registry architecture.

## Design Rules

1. Commands orchestrate and render. They should not own provider protocol details, scheduler XML mechanics, ledger cursor algorithms, or transcript-store discovery.
2. Harness providers execute `AgentRunSpec`s. They may expose runtime status and model-choice facts, but they should not know setup wizard wording or doctor row formatting.
3. Agent readiness combines config and provider status into a user-facing view for setup, agents, and doctor commands.
4. Automation installs, removes, and reports known scheduled tasks. It does not decide capture eligibility.
5. Capture sweep owns transcript eligibility and Absorb enqueueing. It does not render launchd plists.
6. Build, Absorb, and Garden remain Operations. Capture sweep remains a coordinator, not an Operation.

---

## Task 1: Extract Scheduled Task Definitions

**Files:**
- Create: `src/automation/scheduled-task.ts`
- Create: `src/automation/tasks.ts`
- Modify: `src/commands/automation.ts`
- Test: `test/automation.test.ts`

**Step 1: Add scheduled task types**

Create `src/automation/scheduled-task.ts`:

```ts
export type ScheduledTaskId = "capture-sweep" | "garden";

export interface ScheduledTaskDefinition {
  id: ScheduledTaskId;
  label: string;
  plistLabel: string;
  plistFileName: string;
  defaultEvery: string;
  stdoutLogFileName: string;
  stderrLogFileName: string;
  programArguments: string[];
  workingDirectory?: string;
}
```

**Step 2: Add concrete task builders**

Create `src/automation/tasks.ts`:

```ts
import path from "node:path";

import { findNearestAlmanacDir } from "../paths.js";
import type { ScheduledTaskDefinition } from "./scheduled-task.js";

export const CAPTURE_TASK_ID = "capture-sweep";
export const GARDEN_TASK_ID = "garden";

export const DEFAULT_CAPTURE_EVERY = "5h";
export const DEFAULT_CAPTURE_QUIET = "45m";
export const DEFAULT_GARDEN_EVERY = "2d";

export function captureSweepTask(args: {
  quiet: string;
  programArguments: string[];
}): ScheduledTaskDefinition {
  return {
    id: CAPTURE_TASK_ID,
    label: "auto-capture automation",
    plistLabel: "com.codealmanac.capture-sweep",
    plistFileName: "com.codealmanac.capture-sweep.plist",
    defaultEvery: DEFAULT_CAPTURE_EVERY,
    stdoutLogFileName: "capture-sweep.out.log",
    stderrLogFileName: "capture-sweep.err.log",
    programArguments: [...args.programArguments, "capture", "sweep", "--quiet", args.quiet],
  };
}

export function gardenTask(args: {
  cwd: string;
  programArguments: string[];
}): ScheduledTaskDefinition {
  return {
    id: GARDEN_TASK_ID,
    label: "garden automation",
    plistLabel: "com.codealmanac.garden",
    plistFileName: "com.codealmanac.garden.plist",
    defaultEvery: DEFAULT_GARDEN_EVERY,
    stdoutLogFileName: "garden.out.log",
    stderrLogFileName: "garden.err.log",
    programArguments: [...args.programArguments, "garden"],
    workingDirectory: findNearestAlmanacDir(args.cwd) ?? path.resolve(args.cwd),
  };
}
```

**Step 3: Use builders from `automation.ts`**

Keep behavior unchanged. Replace hardcoded capture/Garden command construction with task definitions. Keep existing `defaultProgramArguments()` and setup overrides for now.

**Step 4: Run focused tests**

Run:

```bash
npm test -- test/automation.test.ts test/setup.test.ts test/uninstall.test.ts
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/automation/scheduled-task.ts src/automation/tasks.ts src/commands/automation.ts test/automation.test.ts test/setup.test.ts test/uninstall.test.ts
git commit -m "refactor: define scheduled automation tasks"
```

---

## Task 2: Extract Launchd Mechanics

**Files:**
- Create: `src/automation/launchd.ts`
- Modify: `src/commands/automation.ts`
- Test: `test/automation.test.ts`

**Step 1: Move plist rendering and XML escaping**

Move these functions from `src/commands/automation.ts` to `src/automation/launchd.ts`:

- `renderPlist`
- `writeLaunchdPlist`
- `readAutomationPlist`
- `formatAutomationStatus` only if it remains scheduler-generic
- `readProgramArgumentAfter` only if needed by status
- `escapeXml`
- `unescapeXml`
- `launchctlTarget`
- `defaultExec`

Prefer generic names:

```ts
export async function writeLaunchdTaskPlist(args: {
  plistPath: string;
  label: string;
  programArguments: string[];
  intervalSeconds: number;
  environmentVariables: Record<string, string>;
  workingDirectory?: string;
  stdoutPath: string;
  stderrPath: string;
}): Promise<void>;

export async function bootstrapLaunchdTask(args: {
  plistPath: string;
  exec: ExecFn;
}): Promise<void>;

export async function bootoutLaunchdTask(args: {
  plistPath: string;
  exec: ExecFn;
}): Promise<void>;
```

**Step 2: Keep command behavior stable**

`runAutomationInstall()` should still return the same stdout/stderr shape for now. Do not broaden status behavior in this task.

**Step 3: Run focused tests**

Run:

```bash
npm test -- test/automation.test.ts test/setup.test.ts test/uninstall.test.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/automation/launchd.ts src/commands/automation.ts test/automation.test.ts
git commit -m "refactor: isolate launchd automation mechanics"
```

---

## Task 3: Extract Legacy Hook Cleanup

**Files:**
- Create: `src/automation/legacy-hooks.ts`
- Modify: `src/commands/automation.ts`
- Modify: `src/commands/setup.ts`
- Modify: `src/commands/uninstall.ts`
- Test: `test/setup.test.ts`
- Test: `test/uninstall.test.ts`

**Step 1: Move hook cleanup**

Move from `src/commands/automation.ts` to `src/automation/legacy-hooks.ts`:

- `cleanupLegacyHooks`
- `cleanupLegacyHookFile`
- `removeLegacyHookValues`
- `isLegacyHookCommand`
- `isEmptyWrappedHook`
- `isEmptyHookContainer`

**Step 2: Make migration call sites explicit**

Update setup and uninstall to import `cleanupLegacyHooks` from `src/automation/legacy-hooks.ts`.

The goal is for `automation.ts` to manage scheduled tasks, not provider-era hook migration internals.

**Step 3: Run focused tests**

Run:

```bash
npm test -- test/setup.test.ts test/uninstall.test.ts test/automation.test.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/automation/legacy-hooks.ts src/commands/automation.ts src/commands/setup.ts src/commands/uninstall.ts test/setup.test.ts test/uninstall.test.ts
git commit -m "refactor: isolate legacy hook migration"
```

---

## Task 4: Extract Capture Discovery

**Files:**
- Create: `src/capture/discovery/types.ts`
- Create: `src/capture/discovery/claude.ts`
- Create: `src/capture/discovery/codex.ts`
- Create: `src/capture/discovery/index.ts`
- Modify: `src/commands/capture-sweep.ts`
- Test: `test/capture-sweep.test.ts`

**Step 1: Define discovery types**

Create `src/capture/discovery/types.ts`:

```ts
export type CaptureSourceApp = "claude" | "codex";

export interface SessionCandidate {
  app: CaptureSourceApp;
  sessionId: string;
  transcriptPath: string;
  cwd: string;
  repoRoot: string;
  mtimeMs: number;
  sizeBytes: number;
}
```

**Step 2: Move Claude discovery**

Move these helpers from `capture-sweep.ts` to `src/capture/discovery/claude.ts`:

- `discoverClaude`
- `readClaudeMeta`

Move shared helpers to `index.ts` or a local helper module only if both Claude and Codex use them:

- `collectJsonl`
- `collectJsonlInto`
- `readFirstLines`
- `candidateFromMeta`
- `parseJsonObject`
- `objectField`
- `stringField`

**Step 3: Move Codex discovery**

Move these helpers to `src/capture/discovery/codex.ts`:

- `discoverCodex`
- `readCodexMeta`

Keep subagent skipping behavior unchanged.

**Step 4: Add aggregate discovery**

Create `src/capture/discovery/index.ts`:

```ts
export async function discoverCaptureCandidates(args: {
  apps: CaptureSourceApp[];
  home: string;
}): Promise<SessionCandidate[]> {
  const out: SessionCandidate[] = [];
  if (args.apps.includes("claude")) out.push(...await discoverClaude(args.home));
  if (args.apps.includes("codex")) out.push(...await discoverCodex(args.home));
  return out;
}
```

**Step 5: Update sweep command**

`capture-sweep.ts` should call `discoverCaptureCandidates(...)` and should no longer know provider transcript root paths.

**Step 6: Run focused tests**

Run:

```bash
npm test -- test/capture-sweep.test.ts
```

Expected: all pass.

**Step 7: Commit**

```bash
git add src/capture/discovery src/commands/capture-sweep.ts test/capture-sweep.test.ts
git commit -m "refactor: move transcript discovery out of sweep command"
```

---

## Task 5: Extract Capture Ledger and Locking

**Files:**
- Create: `src/capture/ledger.ts`
- Create: `src/capture/lock.ts`
- Modify: `src/commands/capture-sweep.ts`
- Test: `test/capture-sweep.test.ts`

**Step 1: Move ledger types and helpers**

Move to `src/capture/ledger.ts`:

- `LedgerStatus`
- `LedgerEntry`
- `CaptureLedger`
- `ledgerPath`
- `loadLedgerForRepo`
- `emptyLedger`
- `isLedger`
- `writeLedger`
- `reconcileLedger`
- `terminalRunError`
- `clearPending`
- `freshLedgerEntry`
- `initialLedgerCursor`
- `transcriptLineTimestamp`
- `ledgerKey`
- `sha256`
- `countLines` if only ledger uses it

Export only what `sweep.ts` or command code needs.

**Step 2: Move lock helpers**

Move to `src/capture/lock.ts`:

- `lockPath`
- `lockOwnerPath`
- `acquireRepoLock`
- `tryCreateRepoLock`
- `isStaleRepoLock`
- `isPidAlive`
- `releaseRepoLock`

**Step 3: Keep behavior stable**

Do not change stale lock timeout, ledger path, hash format, or skip reasons.

**Step 4: Run focused tests**

Run:

```bash
npm test -- test/capture-sweep.test.ts
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/capture/ledger.ts src/capture/lock.ts src/commands/capture-sweep.ts test/capture-sweep.test.ts
git commit -m "refactor: isolate capture ledger and sweep locks"
```

---

## Task 6: Extract Capture Sweep Coordinator

**Files:**
- Create: `src/capture/sweep.ts`
- Modify: `src/commands/capture-sweep.ts`
- Test: `test/capture-sweep.test.ts`

**Step 1: Move sweep algorithm**

Create `src/capture/sweep.ts` and move the core algorithm from `runCaptureSweepCommand()` into a domain function:

```ts
export interface CaptureSweepResult {
  scanned: number;
  eligible: number;
  dryRun: boolean;
  captureSince: string | null;
  started: SweepStarted[];
  skipped: SweepSkipped[];
  needsAttention: SweepSkipped[];
}

export async function runCaptureSweep(args: CaptureSweepArgs): Promise<CaptureSweepResult>;
```

`CaptureSweepArgs` should include runtime dependencies such as `now`, `homeDir`, `configPath`, `startBackground`, `using`, and options already passed by the command.

**Step 2: Leave CLI rendering in command file**

`src/commands/capture-sweep.ts` should own:

- option parsing
- `CommandResult` rendering
- JSON/human output formatting

It should not own transcript discovery, ledger mutation, or lock algorithms.

**Step 3: Run focused tests**

Run:

```bash
npm test -- test/capture-sweep.test.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/capture/sweep.ts src/commands/capture-sweep.ts test/capture-sweep.test.ts
git commit -m "refactor: extract capture sweep coordinator"
```

---

## Task 7: Collapse Old Agent Execution Providers

**Files:**
- Modify: `src/agent/types.ts`
- Modify: `src/agent/providers/claude/index.ts`
- Modify: `src/agent/providers/codex-cli.ts`
- Modify: `src/agent/providers/cursor-cli.ts`
- Delete if unused: `src/agent/providers/jsonl-cli.ts`
- Delete if unused: `src/agent/providers/prompt.ts`
- Modify tests that import removed execution-only types

**Step 1: Verify no production caller uses old provider `run()`**

Run:

```bash
rg -n "getAgentProvider\\([^)]*\\)\\.run|\\.run\\(opts: RunAgentOptions\\)|RunAgentOptions|AgentResult|runJsonlCli|combinedPrompt" src test
```

Expected: no production call path invokes `getAgentProvider(...).run(...)`; current operation execution should go through `src/process/manager.ts` and `src/harness/providers`.

**Step 2: Remove execution members from `AgentProvider`**

In `src/agent/types.ts`, remove:

- `RunAgentOptions`
- `AgentStreamMessage`
- `AgentUsage`
- `AgentResult`
- `AgentProvider.run`

Keep status/model-choice types needed by setup, agents, and doctor.

**Step 3: Remove old run implementations**

Remove `run` implementations from:

- `src/agent/providers/claude/index.ts`
- `src/agent/providers/codex-cli.ts`
- `src/agent/providers/cursor-cli.ts`

Delete `src/agent/providers/jsonl-cli.ts` and `src/agent/providers/prompt.ts` if no imports remain.

**Step 4: Run provider/setup tests**

Run:

```bash
npm test -- test/provider-view.test.ts test/agents-command.test.ts test/setup.test.ts test/doctor.test.ts test/auth.test.ts
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/agent test
git commit -m "refactor: remove legacy agent execution providers"
```

---

## Task 8: Make Harness Providers the Source for Status and Model Choices

**Files:**
- Modify: `src/harness/types.ts`
- Modify: `src/harness/providers/metadata.ts`
- Modify: `src/harness/providers/claude.ts`
- Modify: `src/harness/providers/codex.ts`
- Modify: `src/harness/providers/cursor.ts`
- Modify: `src/agent/provider-view.ts`
- Modify or create: `src/agent/fixes.ts`
- Test: `test/provider-view.test.ts`
- Test: `test/agents-command.test.ts`
- Test: harness provider tests

**Step 1: Add optional model choices to harness provider contract**

Extend `HarnessProvider` with:

```ts
modelChoices?(opts: {
  configuredModel: string | null;
}): Promise<ProviderModelChoice[]> | ProviderModelChoice[];
```

Reuse or move `ProviderModelChoice` from `src/agent/types.ts`.

**Step 2: Move model-choice logic**

Move Claude/Codex model-choice logic from old agent providers into harness provider modules or helper files under `src/harness/providers/`.

Do not add model choices to Cursor unless existing behavior already has them.

**Step 3: Update `provider-view.ts`**

Change `buildProviderSetupView()` to use `listHarnessProviders()` instead of `listProviderStatuses()` / `getAgentProvider()`.

It should still output the same `ProviderSetupView` shape for setup, agents, and doctor.

**Step 4: Keep fix text outside harness**

Move `LOGIN_FIXES` and `INSTALL_FIXES` into `src/agent/fixes.ts`. Harness providers should not know user-facing setup instructions.

**Step 5: Run tests**

Run:

```bash
npm test -- test/provider-view.test.ts test/agents-command.test.ts test/setup.test.ts test/doctor.test.ts test/claude-harness-provider.test.ts test/codex-harness-provider.test.ts
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/harness src/agent test
git commit -m "refactor: project agent readiness from harness providers"
```

---

## Task 9: Rename Agent Provider View to Readiness

**Files:**
- Move: `src/agent/provider-view.ts` -> `src/agent/readiness.ts`
- Modify imports in `src/commands/setup.ts`
- Modify imports in `src/commands/agents.ts`
- Modify imports in `src/commands/doctor-checks/agents.ts`
- Modify tests importing provider view

**Step 1: Rename module**

Move `provider-view.ts` to `readiness.ts`.

Keep exported names stable if that reduces churn, or rename deliberately:

- `ProviderSetupView` -> `AgentReadinessView`
- `ProviderSetupChoice` -> `AgentReadinessChoice`
- `buildProviderSetupView` -> `buildAgentReadinessView`

If renaming exports, update all call sites in the same commit.

**Step 2: Run tests**

Run:

```bash
npm test -- test/provider-view.test.ts test/agents-command.test.ts test/setup.test.ts test/doctor.test.ts
```

If the test file name becomes misleading, rename it to `test/agent-readiness.test.ts`.

**Step 3: Commit**

```bash
git add src/agent src/commands test
git commit -m "refactor: rename provider setup view to agent readiness"
```

---

## Task 10: Move Global Config Out of `src/update/config.ts`

**Files:**
- Create directory: `src/config/`
- Move: `src/update/config.ts` -> `src/config/index.ts`
- Move or copy: config key helpers from `src/commands/config-keys.ts` only if useful
- Modify imports across `src/` and `test/`
- Leave compatibility re-export: `src/update/config.ts`

**Step 1: Move config implementation**

Move global config implementation to `src/config/index.ts`.

Keep `src/update/config.ts` as a compatibility re-export:

```ts
export * from "../config/index.js";
```

This avoids a huge import-only diff in the first pass and preserves external import stability inside the repo.

**Step 2: Update high-value imports**

Update imports in actively maintained areas:

- `src/commands/automation.ts`
- `src/commands/capture-sweep.ts` or new `src/capture/sweep.ts`
- `src/commands/operations.ts`
- `src/commands/setup.ts`
- `src/agent/readiness.ts`

Do not chase every import in one commit unless mechanical and safe.

**Step 3: Run tests**

Run:

```bash
npm test
npm run build
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/config src/update/config.ts src test
git commit -m "refactor: move global config out of update namespace"
```

---

## Task 11: Improve Automation Status Without Expanding Scope

**Files:**
- Modify: `src/automation/launchd.ts`
- Modify: `src/commands/automation.ts`
- Test: `test/automation.test.ts`

**Step 1: Add loaded-state probe behind dependency injection**

Add an optional launchctl probe helper:

```ts
export async function readLaunchdTaskState(args: {
  label: string;
  exec: ExecFn;
}): Promise<"loaded" | "not-loaded" | "unknown">;
```

Use `launchctl print gui/<uid>/<label>` on macOS. Treat command failure as `not-loaded` or `unknown` depending on stderr shape. Keep tests injected; do not make status flaky on non-macOS.

**Step 2: Report paths and commands**

`automation status` should continue to work from plist contents, but include:

- plist path
- interval
- command
- quiet window for capture
- stdout/stderr log paths
- loaded state if available

**Step 3: Do not read run ledgers in this task**

Run state remains under `.almanac/runs/`; scheduler status should point users to logs but should not become capture health analysis.

**Step 4: Run tests**

Run:

```bash
npm test -- test/automation.test.ts
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/automation src/commands/automation.ts test/automation.test.ts
git commit -m "fix: report scheduler status beyond plist presence"
```

---

## Task 12: Documentation and Wiki Updates

**Files:**
- Modify: `.almanac/pages/automation.md` if facts changed
- Modify: `.almanac/pages/capture-automation.md` if facts changed
- Modify: `.almanac/pages/harness-providers.md` if provider boundaries changed
- Modify: `.almanac/pages/wiki-lifecycle-operations.md` if terminology changed
- Optional: create or update a page about provider lifecycle boundaries if already present in the working tree

**Step 1: Check wiki pages**

Run:

```bash
almanac search "automation scheduled task operation run provider readiness" --limit 10
almanac show automation
almanac show harness-providers
almanac show wiki-lifecycle-operations
```

**Step 2: Update durable facts only**

Update pages only for changed durable boundaries:

- Automation schedules known tasks.
- `capture sweep` is a coordinator, not an Operation.
- Harness providers are the only execution providers.
- Agent readiness is the setup/agents/doctor projection over config plus provider status.

**Step 3: Run health**

Run:

```bash
almanac health
```

Expected: no new broken links/dead refs from the refactor.

**Step 4: Commit**

```bash
git add .almanac/pages
git commit -m "docs: update provider and automation boundaries"
```

---

## Verification Ladder

After each task, run the focused tests listed in the task.

Before final handoff, run:

```bash
npm test
npm run build
```

Manual smoke checks after automation extraction:

```bash
node dist/codealmanac.js automation --help
node dist/codealmanac.js automation install --every 1h --quiet 1m --garden-off
node dist/codealmanac.js automation status
node dist/codealmanac.js automation uninstall
```

Manual smoke checks after capture extraction:

```bash
node dist/codealmanac.js capture sweep --dry-run --json
```

Do not claim launchd actually ran a scheduled job unless you perform a machine-level `launchctl kickstart` and inspect `~/.almanac/logs/`.

## Review Checklist

- `src/commands/automation.ts` is a CLI wrapper, not the owner of plist rendering, hook cleanup, and task definitions.
- `src/commands/capture-sweep.ts` is a CLI wrapper, not the owner of transcript discovery, ledger state, and locks.
- `src/harness/providers/` is the only execution provider layer.
- No production code calls old `src/agent/providers/*` `run()` methods.
- Setup, agents, and doctor consume one shared agent readiness projection.
- `automation` schedules tasks, not Operations.
- `capture sweep` remains a coordinator that may start Absorb Runs.
- Config imports no longer imply global config belongs to update-notifier code.

## Expected End State

A fresh maintainer should be able to answer:

- To add a new scheduled Almanac task, edit `src/automation/tasks.ts` and scheduler tests.
- To change launchd XML behavior, edit `src/automation/launchd.ts`.
- To change transcript discovery, edit `src/capture/discovery/`.
- To change capture dedupe/cursors, edit `src/capture/ledger.ts`.
- To change provider runtime behavior, edit `src/harness/providers/`.
- To change setup/doctor readiness presentation, edit `src/agent/readiness.ts`.
- To change persisted global config, edit `src/config/`.


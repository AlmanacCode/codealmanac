# Managed Provider Process Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Unix-shaped process-group helper with a provider-process abstraction that provider adapters can use without knowing platform-specific process-tree cleanup details.

**Architecture:** Provider adapters should ask for a managed provider process and receive a child process plus lifecycle helpers. POSIX cleanup uses detached process groups and negative-pid signaling. Windows provider-process cleanup is intentionally unsupported until there is a tested implementation; the managed boundary should fail clearly on Windows rather than claim unverified process-tree ownership.

**Tech Stack:** TypeScript, Node child_process, Vitest, existing harness provider adapters.

---

### Task 1: Introduce Managed Provider Process Boundary

**Files:**
- Create: `src/process/managed-child.ts`
- Modify: `src/process/index.ts`
- Test: `test/managed-child.test.ts`

**Step 1: Write managed-child tests**

Cover:
- spawning a fixture child and grandchild through the managed helper
- `terminate()` kills both processes on POSIX
- termination escalates when graceful termination is ignored
- `attachAbort()` terminates the child tree when an abort signal fires

Use existing fixture helpers from `test/helpers.ts`.

**Step 2: Run focused test and verify it fails**

Run:

```bash
npm test -- test/managed-child.test.ts
```

Expected: fail because `src/process/managed-child.ts` does not exist.

**Step 3: Implement the managed boundary**

Create a wrapper interface:

```ts
export interface ManagedChildProcess {
  child: ChildProcess;
  readonly treeId?: number;
  terminate(options?: TerminateManagedChildOptions): Promise<void>;
  attachAbort(signal: AbortSignal, options?: TerminateManagedChildOptions): () => void;
}
```

Expose:

```ts
export function spawnManagedChildProcess(
  command: string,
  args: readonly string[],
  options: SpawnOptions,
): ManagedChildProcess
```

Implementation rules:
- POSIX: use `detached: true`, record child pid as `treeId`, signal `-treeId`, wait, then escalate.
- Windows: throw a clear unsupported-platform error before spawning. Do not add `taskkill`, Job Object, or child-only cleanup until it can be tested.
- Do not monkey-patch `child.kill`.
- Treat `ESRCH` as unavailable. Do not treat `EPERM` as dead.

**Step 4: Run tests**

Run:

```bash
npm test -- test/managed-child.test.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/process/managed-child.ts src/process/index.ts test/managed-child.test.ts
git commit -m "feat: add managed provider process abstraction"
```

### Task 2: Move Providers Onto Managed Process Boundary

**Files:**
- Modify: `src/harness/providers/claude.ts`
- Modify: `src/harness/providers/codex/app-server.ts`
- Modify: `src/harness/providers/codex/exec.ts`
- Test: `test/claude-harness-provider.test.ts`
- Test: `test/codex-harness-provider.test.ts`

**Step 1: Update Claude SDK spawn hook**

Replace direct `spawnInProcessGroup()` use with `spawnManagedChildProcess()`.
The SDK-facing object should delegate `kill()` to `managed.terminate({ signal })`.

**Step 2: Update Codex app-server**

Replace direct process-group spawning and termination with the managed process wrapper. Keep existing timeout and signal behavior.

**Step 3: Update Codex exec**

Move legacy Codex exec to the managed process helper too. This keeps every CLI-backed provider runtime under the same cleanup contract even if app-server is the normal Codex path.

**Step 4: Run focused provider tests**

Run:

```bash
npm test -- test/claude-harness-provider.test.ts test/codex-harness-provider.test.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add src/harness/providers/claude.ts src/harness/providers/codex/app-server.ts src/harness/providers/codex/exec.ts test/claude-harness-provider.test.ts test/codex-harness-provider.test.ts
git commit -m "refactor: use managed provider processes"
```

### Task 3: Remove Old Process-Group Surface

**Files:**
- Delete: `src/process/process-group.ts`
- Delete or rename: `test/process-group.test.ts`
- Modify imports in source and tests.

**Step 1: Search for old names**

Run:

```bash
rg -n "process-group|spawnInProcessGroup|terminateProcessGroup|attachAbortSignalToProcessGroup|ProcessGroupChild" src test
```

Expected: only old files before cleanup.

**Step 2: Remove old files and exports**

Use `apply_patch` to delete old files or move the remaining useful tests into `test/managed-child.test.ts`.

**Step 3: Run focused process/provider tests**

Run:

```bash
npm test -- test/managed-child.test.ts test/claude-harness-provider.test.ts test/codex-harness-provider.test.ts
```

Expected: pass.

**Step 4: Commit**

```bash
git add -A src/process test
git commit -m "refactor: remove process-group provider surface"
```

### Task 4: Update Wiki Decision Log

**Files:**
- Modify: `.almanac/pages/process-manager-runs.md`
- Modify: `.almanac/pages/harness-providers.md`
- Modify: `.almanac/pages/capture-automation.md` if needed.

**Step 1: Update prose**

Record:
- provider process ownership is a harness/provider execution concern
- managed child process is the abstraction
- POSIX process groups are implementation detail
- Windows provider-process cleanup is explicitly unsupported until tested

**Step 2: Run wiki health**

Run:

```bash
almanac health
```

Expected: all categories ok.

**Step 3: Commit**

```bash
git add .almanac/pages/process-manager-runs.md .almanac/pages/harness-providers.md .almanac/pages/capture-automation.md
git commit -m "almanac: record managed provider process boundary"
```

### Task 5: Review, Verify, Squash, Merge

**Step 1: Request code review**

Review the full branch against `origin/dev`, focusing on abstraction placement, process cleanup correctness, platform behavior, and test coverage.

**Step 2: Fix review findings**

Commit review fixes separately.

**Step 3: Full verification**

Run:

```bash
npm run lint
npm run build
npm test
almanac health
```

Expected: all pass.

**Step 4: Squash branch**

Squash branch commits into one implementation commit before merging to `dev`.

**Step 5: Merge and push**

Fast-forward or merge the squashed commit into `dev`, then push `origin dev`.

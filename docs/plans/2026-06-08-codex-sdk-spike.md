# Codex SDK Spike Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decide whether `@openai/codex-sdk` should replace CodeAlmanac's current Codex app-server harness transport, and remove stale Codex exec compatibility if the SDK is not the replacement yet.

**Architecture:** Keep `AgentRunSpec` and `HarnessEvent` as the provider-neutral boundary. Any SDK experiment must stay inside `src/harness/providers/codex*` and must not leak SDK event types or options into operations, process management, setup, or CLI commands.

**Tech Stack:** TypeScript, Vitest, Codex app-server JSON-RPC, `@openai/codex-sdk`, Codex CLI `exec --experimental-json`, Node child processes.

---

## Current Architecture

The current Codex path is app-server-first:

```ts
const spec = operation.buildAgentRunSpec();

const provider = createCodexHarnessProvider();
const result = await provider.run(spec, {
  onEvent: (event) => processManager.writeHarnessEvent(event),
});
```

The provider facade validates provider-neutral fields and calls the app-server adapter:

```ts
async function run(spec: AgentRunSpec, hooks?: HarnessRunHooks) {
  if (spec.agents) return unsupported("per-run programmatic agents");
  assertNoUnsupportedCodexFields(spec);
  return runCodexAppServer(spec, hooks);
}
```

The app-server adapter owns the raw provider protocol:

```ts
const child = spawnManagedChildProcess("codex", [
  "app-server",
  "--config",
  "mcp_servers={}",
  "--listen",
  "stdio://",
]);

await rpc("initialize", { capabilities: { experimentalApi: true } });
const thread = await rpc("thread/start", {
  cwd: spec.cwd,
  model: spec.provider.model ?? null,
  approvalPolicy: "never",
  sandbox: "workspace-write",
  developerInstructions: spec.systemPrompt ?? null,
  ephemeral: spec.providerSession?.persistence === "ephemeral",
});

const turn = await rpc("turn/start", {
  threadId: thread.id,
  input: [{ type: "text", text: spec.prompt }],
  sandboxPolicy: {
    type: "workspaceWrite",
    writableRoots: [spec.cwd],
    networkAccess: spec.networkAccess === true,
  },
  effort: spec.provider.effort ?? null,
  outputSchema: spec.output?.kind === "json_schema" ? spec.output.schema : null,
});

for await (const notification of appServerNotifications(child)) {
  const events = mapCodexAppServerNotification(notification, state, {
    rootThreadId,
    rootTurnId,
    isRootCompletion,
  });
  emit(events);
  if (isRootTurnCompleted(notification)) return toHarnessResult(state);
}
```

The live app-server path has four load-bearing properties:

- it passes `ephemeral` for maintenance runs so Almanac jobs do not create durable provider session history;
- it uses `spawnManagedChildProcess`, so timeout/cancel cleanup owns the provider process group;
- app-server notifications include `threadId` and `turnId`, which power root/helper actor attribution and prevent helper `turn/completed` events from ending the whole run;
- it disables user-level Codex MCP leakage with `mcp_servers={}` while preserving normal Codex auth.

## SDK Evidence

Official docs:

- OpenAI's Codex SDK page says the TypeScript SDK controls local Codex agents, is for server-side use, requires Node.js 18 or later, and installs with `npm install @openai/codex-sdk`: <https://developers.openai.com/codex/sdk>
- The SDK docs show `Codex`, `startThread()`, `thread.run()`, `thread.runStreamed()`, `resumeThread(id)`, working-directory controls, environment controls, config overrides, image inputs, and per-turn output schema.
- The OpenAI code-generation guide positions Codex as usable through web, IDE, CLI, and SDK interfaces: <https://developers.openai.com/api/docs/guides/code-generation>

Package evidence:

```text
@openai/codex-sdk latest: 0.137.0
@openai/codex-sdk alpha: 0.138.0-alpha.6
engines: >=18
dependency: @openai/codex 0.137.0
local codex CLI: codex-cli 0.134.0
repo engine: 20.x || 22.x || 23.x || 24.x || 25.x
current shell Node: 21.7.3, so npm install warns even though the spike worktree still builds
```

The package `dist/index.d.ts` exposes:

```ts
type ThreadOptions = {
  model?: string;
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  workingDirectory?: string;
  skipGitRepoCheck?: boolean;
  modelReasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  networkAccessEnabled?: boolean;
  webSearchMode?: "disabled" | "cached" | "live";
  approvalPolicy?: "never" | "on-request" | "on-failure" | "untrusted";
  additionalDirectories?: string[];
};

type TurnOptions = {
  outputSchema?: unknown;
  signal?: AbortSignal;
};

type ThreadEvent =
  | { type: "thread.started"; thread_id: string }
  | { type: "turn.started" }
  | { type: "item.started"; item: ThreadItem }
  | { type: "item.updated"; item: ThreadItem }
  | { type: "item.completed"; item: ThreadItem }
  | { type: "turn.completed"; usage: Usage }
  | { type: "turn.failed"; error: ThreadError }
  | { type: "error"; message: string };
```

A fake-binary probe against the unpacked SDK confirmed the TypeScript SDK does not call `codex app-server`. It shells out through `codex exec --experimental-json`, writes the prompt to stdin, creates a temporary `--output-schema` file, and emits normalized SDK events.

Observed SDK argv for a representative run:

```text
exec
--experimental-json
--model gpt-5.4
--sandbox workspace-write
--cd /Users/rohan/.config/superpowers/worktrees/codealmanac/codex-sdk-spike
--skip-git-repo-check
--output-schema /var/.../codex-output-schema-.../schema.json
--config model_reasoning_effort="high"
--config sandbox_workspace_write.network_access=true
--config approval_policy="never"
```

## Compatibility Matrix

| Harness need | Current app-server adapter | TypeScript SDK 0.137.0 |
| --- | --- | --- |
| `spec.cwd` | `thread/start.cwd`, `turn/start.cwd`, writable root | `workingDirectory`, `--cd` |
| `spec.provider.model` | `thread/start.model`, `turn/start.model` | `model`, `--model` |
| `spec.provider.effort` | `turn/start.effort` | `modelReasoningEffort`, `--config model_reasoning_effort=...` |
| `spec.networkAccess` | `sandboxPolicy.networkAccess` | `networkAccessEnabled`, `--config sandbox_workspace_write.network_access=...` |
| `spec.output.schema` | direct `turn/start.outputSchema` object | temporary `--output-schema` file |
| disable user MCP leakage | `--config mcp_servers={}` | possible through `new Codex({ config: { mcp_servers: {} } })`, but not tested against real Codex |
| noninteractive approvals | explicit JSON-RPC request denial and `approvalPolicy: "never"` | `approvalPolicy: "never"` config only |
| `providerSession.persistence = "ephemeral"` | direct `thread/start.ephemeral` | no SDK option, even though local `codex exec` supports `--ephemeral` |
| process cleanup | managed POSIX process group with timeout/cancel cleanup | SDK hides the child process and only exposes `AbortSignal`; its internal cleanup calls `child.kill()` |
| actor attribution | app-server events carry `threadId` / `turnId` | item events omit thread/turn ids; only `thread.started` has a thread id |
| helper turn safety | root turn id gates terminal completion | SDK event stream has no turn id, so helper-vs-root cannot be proven from public types |
| dependency shape | uses user's installed `codex` on PATH | bundles/pins `@openai/codex` 0.137.0 and can override path/env |

## Decision

Do not replace the current Codex app-server adapter with `@openai/codex-sdk` in this branch.

The SDK is a good official wrapper around `codex exec --experimental-json`, and it fixes several old `exec` pain points: typed events, stdin prompting, output schema handling, reasoning effort config, network config, and bundled runtime lookup. It does not yet preserve the app-server adapter's load-bearing lifecycle behavior: ephemeral maintenance sessions, process-group cleanup, item-level actor attribution, and root-turn completion gating.

The right near-term architecture is:

```ts
// keep
spec -> runCodexAppServer(spec) -> app-server JSON-RPC -> HarnessEvent

// delete
spec -> buildCodexExecRequest(spec) -> runCodexCli(request) -> legacy JSONL parser

// future, only if SDK adds the missing controls or we accept the tradeoff
spec -> runCodexSdk(spec) -> sdk.runStreamed(...) -> HarnessEvent
```

## Task 1: Delete stale Codex exec compatibility

**Files:**

- Delete: `src/harness/providers/codex/exec.ts`
- Delete: `src/harness/providers/codex/jsonl-events.ts`
- Modify: `src/harness/providers/codex.ts`
- Modify: `src/harness/providers/codex/request.ts`
- Modify: `src/harness/providers/codex/events.ts`
- Modify: `src/harness/providers/codex/usage.ts`
- Modify: `test/codex-harness-provider.test.ts`
- Modify docs only where they describe current code, not historical plans.

**Steps:**

1. Remove `CodexExecRequest` and `buildCodexExecRequest` from `request.ts`.
2. Remove `CodexCliRunFn`, `runCli`, `runCodexCli`, `applyCodexJsonlEvent`, and `parseCodexUsage` exports from the Codex facade.
3. Keep `parseCodexUsage` only if app-server usage parsing still needs it internally; otherwise inline a private helper in `usage.ts`.
4. Delete tests whose only purpose is the legacy `codex exec --json` path.
5. Keep app-server fake-process tests unchanged.
6. Run `npm run lint`, focused Codex tests, full `npm test`, and `npm run build`.

## Task 2: Optional SDK adapter only if lifecycle blockers are resolved

Do not add `@openai/codex-sdk` as a dependency during this spike unless one of these becomes true:

- the SDK exposes `ephemeral` or a raw argument/config hook that can pass `--ephemeral`;
- the SDK exposes process ownership or accepts a spawn hook that can use CodeAlmanac's managed child process boundary;
- the SDK event stream exposes root/helper ownership signals sufficient for `.almanac/runs/` actor attribution;
- the product accepts losing those properties for Codex runs, which would be a behavior change and needs explicit review.

If those blockers are resolved, the adapter shape should look like this:

```ts
async function runCodexSdk(spec: AgentRunSpec, hooks?: HarnessRunHooks) {
  const codex = new Codex({
    config: { mcp_servers: {} },
    env: codexEnv(),
  });

  const thread = codex.startThread({
    model: spec.provider.model,
    sandboxMode: "workspace-write",
    workingDirectory: spec.cwd,
    skipGitRepoCheck: true,
    modelReasoningEffort: spec.provider.effort,
    networkAccessEnabled: spec.networkAccess === true,
    approvalPolicy: "never",
  });

  const { events } = await thread.runStreamed(combineCodexPrompt(spec), {
    outputSchema: spec.output?.kind === "json_schema" ? spec.output.schema : undefined,
    signal: abortController.signal,
  });

  for await (const event of events) {
    emit(mapCodexSdkEvent(event, state));
  }

  return toHarnessResult(state);
}
```

That pseudocode is intentionally not implementation-ready because it does not solve ephemeral sessions, managed process cleanup, or actor attribution.

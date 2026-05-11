# Agent-thread-aware run logging

Date: 2026-05-11

Implementation status: implemented in the local working tree on 2026-05-11.
New run logs are written as V2 envelopes; old logs remain readable. Codex
app-server events carry provider-derived root/helper actors and root-only
terminal completion. Claude streamed events carry provider/derived actors using
`session_id` and `parent_tool_use_id`. The viewer API derives agent traces and
warnings, and `almanac serve` renders those sections in job details.

## Why this exists

`almanac init --using codex` can spawn helper agents through Codex app-server.
The current run log is a mostly flat event stream, which is good enough for a
single agent but too weak for runs that include subagents.

The debugging failure that exposed this:

- A build run started from an empty `.almanac/` wiki.
- The root agent spawned helper agents for read-only workbook investigation.
- The final run result looked like a helper's read-only summary rather than a
  root-agent synthesis.
- The run ended `done` with `created: 0`.
- A tool call appeared in the stream, but the log could not reliably prove
  whether the root agent or a helper agent made that tool call.

The important question is not MCP-specific. MCP was just the easiest symptom to
spot. The general product requirement is:

> For every message and tool call in a run, we should be able to tell whether it
> came from the main agent, a specific subagent, or an unknown actor.

If the provider does not expose enough metadata to attribute an event, the log
should say `unknown` explicitly instead of letting the UI imply certainty.

## Current behavior

Run storage today:

```text
.almanac/runs/<run-id>.json
.almanac/runs/<run-id>.jsonl
```

The JSON record stores status, target metadata, provider session id, summary,
timing, and failure information.

The JSONL file stores normalized `HarnessEvent` records. These are appended by
the process manager via `onEvent` hooks from the provider adapter.

Codex app-server flow today:

```text
codealmanac
  -> codex app-server
  -> initialize
  -> thread/start
  -> turn/start
  -> stream notifications
  -> wait for turn/completed
  -> mark run done/failed
```

The model does not run a CodeAlmanac command to finish. The Codex adapter ends
the run when app-server emits `turn/completed`.

`state.result` is currently updated when an app-server `item/completed` event
contains an `agentMessage` item:

```ts
state.result = text;
```

That is risky if helper-agent messages are also surfaced as `agentMessage`
items. Without actor/thread ownership, a helper's final response can look the
same as the root agent's final response.

## What the current logs can prove

The logs can prove:

- The root Codex thread id returned from `thread/start`.
- Agent spawn tool events, including `senderThreadId`, helper prompt, and
  `receiverThreadIds`.
- Agent wait tool events, including the helper thread ids being waited on.
- Some helper final messages, when surfaced inside the wait result.
- Tool kind, title, status, id, input, and result for many app-server items.

The logs cannot reliably prove:

- Which thread produced every assistant text delta.
- Which thread produced every `agentMessage`.
- Which thread invoked every shell/read/search/write/MCP/dynamic tool call.
- Whether the terminal `done` result came from the root agent or from a helper.
- Whether a helper completion was incorrectly treated as the root run result.

This is the core gap.

## Confirmed raw Codex app-server behavior

A direct raw-protocol probe on 2026-05-11 confirmed that Codex app-server does
provide ownership metadata on the outer notification envelope for the cases we
care about.

Observed raw notification shape for a root shell command:

```json
{
  "method": "item/started",
  "params": {
    "threadId": "019e165a-f251-7dc0-b6a2-121d81913106",
    "turnId": "019e165a-f2a7-7591-b913-6d12f8a3aafe",
    "item": {
      "type": "commandExecution",
      "id": "call_l4v8tLU0Xsa387IBrOtUwrNc",
      "command": "/bin/zsh -lc pwd"
    }
  }
}
```

Observed raw notification shape for a helper shell command:

```json
{
  "method": "item/started",
  "params": {
    "threadId": "019e165b-2983-7903-b352-f04c0a65548d",
    "turnId": "019e165b-2991-7de1-b73f-ca8caeae831b",
    "item": {
      "type": "commandExecution",
      "id": "call_Wx7n33FMFMsVDSSjQRHI77kZ",
      "command": "/bin/zsh -lc pwd"
    }
  }
}
```

Observed raw notification shape for a helper final message:

```json
{
  "method": "item/completed",
  "params": {
    "threadId": "019e165b-2983-7903-b352-f04c0a65548d",
    "turnId": "019e165b-2991-7de1-b73f-ca8caeae831b",
    "item": {
      "type": "agentMessage",
      "phase": "final_answer",
      "text": "The current directory is ..."
    }
  }
}
```

The thread id is on `params.threadId`, not necessarily on `params.item`. Current
CodeAlmanac mapping reads `params.threadId` only to initialize
`providerSessionId`; it does not attach that actor id to emitted `HarnessEvent`
records. This is a CodeAlmanac logging/mapping loss, not an absence of Codex
ownership data for these cases.

The same probe also showed that Codex app-server emits `turn/completed` for
helper turns:

```json
{
  "method": "turn/completed",
  "params": {
    "threadId": "019e165b-2983-7903-b352-f04c0a65548d",
    "turnId": "019e165b-2991-7de1-b73f-ca8caeae831b"
  }
}
```

Current CodeAlmanac finishes the whole harness run on any `turn/completed`
notification. It does not check that the completed turn belongs to the root
thread/turn started by CodeAlmanac. This makes it plausible, and now
protocol-level supported, that a helper turn can terminate the overall run
early.

## Confirmed Claude SDK behavior

A live `@anthropic-ai/claude-agent-sdk` probe on 2026-05-11 also confirmed that
Claude exposes enough provenance to separate root events from subagent events,
but the shape is different from Codex.

Observed root tool call:

```json
{
  "type": "assistant",
  "uuid": "06e7bcd0-596d-4a9f-9323-5caa47907d85",
  "session_id": "7aea79f6-a297-4ccd-adc7-d97a4a9dec24",
  "parent_tool_use_id": null,
  "message": {
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_013AjXGcJiNqeoy7fVLwd126",
        "name": "Bash"
      }
    ]
  }
}
```

Observed parent `Agent` call:

```json
{
  "type": "assistant",
  "uuid": "d6c336b0-98d3-4832-bd35-901848e0c1c0",
  "session_id": "7aea79f6-a297-4ccd-adc7-d97a4a9dec24",
  "parent_tool_use_id": null,
  "message": {
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01DYAKMpUFLCMUVUTmx5goPa",
        "name": "Agent"
      }
    ]
  }
}
```

Observed forwarded subagent tool call:

```json
{
  "type": "assistant",
  "uuid": "e61d257a-9353-434e-9b4a-05e959c0acaa",
  "session_id": "7aea79f6-a297-4ccd-adc7-d97a4a9dec24",
  "parent_tool_use_id": "toolu_01DYAKMpUFLCMUVUTmx5goPa",
  "message": {
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01L1Jo9QHAMin4uv5S3RPFnV",
        "name": "Bash"
      }
    ]
  }
}
```

The streamed assistant/user messages did not include an inline `agent_id`.
Instead, forwarded subagent messages were attributable because their
`parent_tool_use_id` matched the parent `Agent` tool call. The SDK also exposed
the concrete subagent id through `listSubagents(sessionId)` and the subagent
transcript through `getSubagentMessages(sessionId, agentId)`.

The SDK type declarations also expose `agent_id` in hook inputs and `agentID`
in permission callbacks. Those ids are available at hook/permission boundaries,
not on every normal streamed assistant/user message. Current CodeAlmanac
Claude mapping drops `uuid`, `session_id`, and `parent_tool_use_id`, so this is
also a CodeAlmanac logging/mapping loss.

## Goals

1. Attribute every event to an actor when possible.
2. Preserve uncertainty honestly when attribution is not possible.
3. Make helper-agent lifecycles first-class in logs and viewer UI.
4. Make terminal run completion provenance visible.
5. Let `almanac serve` answer "who did what, when?" without raw JSON spelunking.
6. Detect suspicious runs, especially build/init runs that finish with no pages.

## Non-goals

- Adding MCP support. The design is generic across tool kinds.
- Changing the public `.almanac/pages/` content model.
- Requiring a frontend build system for the viewer.
- Replacing JSONL run logs with a database.
- Trusting guessed actor ownership as fact.

## Proposed event envelope

Keep the JSONL append-only model, but wrap normalized harness events in an
explicit run-event envelope.

```ts
type RunLogEntryV2 = {
  version: 2;
  timestamp: string;
  sequence: number;
  runId: string;
  actor: RunActor;
  event: HarnessEvent;
  raw?: unknown;
};

type RunActor = {
  threadId: string | null;
  role: "root" | "helper" | "unknown";
  parentThreadId?: string | null;
  label?: string;
  confidence: "provider" | "derived" | "unknown";
};
```

Examples:

```json
{
  "version": 2,
  "sequence": 42,
  "actor": {
    "threadId": "019e1646-9ed0-7743-9421-8f866c786642",
    "role": "root",
    "confidence": "provider",
    "label": "Main"
  },
  "event": {
    "type": "tool_use",
    "tool": "shell"
  }
}
```

```json
{
  "version": 2,
  "sequence": 107,
  "actor": {
    "threadId": "019e1647-3dee-7a20-9a5b-ac40e55c727e",
    "role": "helper",
    "parentThreadId": "019e1646-9ed0-7743-9421-8f866c786642",
    "confidence": "provider",
    "label": "Helper 2"
  },
  "event": {
    "type": "tool_use",
    "tool": "shell"
  }
}
```

```json
{
  "version": 2,
  "sequence": 108,
  "actor": {
    "threadId": null,
    "role": "unknown",
    "confidence": "unknown",
    "label": "Unknown actor"
  },
  "event": {
    "type": "tool_use",
    "tool": "shell"
  }
}
```

The `unknown` case is intentional. It is better to tell the user "we cannot
attribute this event" than to fake root/helper ownership.

## Agent registry

During a run, the provider adapter should maintain a lightweight registry:

```ts
type AgentRegistry = {
  rootThreadId: string | null;
  agents: Map<string, AgentTrace>;
};

type AgentTrace = {
  threadId: string;
  role: "root" | "helper";
  parentThreadId: string | null;
  label: string;
  prompt?: string;
  model?: string;
  reasoningEffort?: string;
  status: "started" | "running" | "completed" | "failed" | "unknown";
};
```

Population rules:

- `thread/start` result registers the root thread.
- `collabAgentToolCall` with `tool: "spawnAgent"` and `senderThreadId` records
  the parent.
- The corresponding spawn result records `receiverThreadIds` as helper threads.
- `collabAgentToolCall` with `tool: "wait"` records wait edges.
- Wait results with `agentsStates` update helper completion state and message.

The registry should be used only for attribution when an event carries a thread
id. If an event lacks a thread id, the registry can provide context in the UI
but should not invent ownership.

## Provider extraction

For each Codex app-server notification, the adapter should try to extract:

- `params.threadId`
- `params.turnId`
- `params.item.threadId`
- `params.item.senderThreadId`
- `params.item.receiverThreadIds`
- any future Codex ownership field on `item`

Then attach a `RunActor` to every emitted event.

If Codex does not include a thread id on item events, the adapter should emit
`actor.role = "unknown"` and preserve the raw app-server item so protocol drift
can be inspected later.

## Terminal result provenance

Terminal run completion should record provenance explicitly.

Today:

```ts
{ type: "done", result: state.result }
```

Proposed:

```ts
type DoneEvent = {
  type: "done";
  result: string;
  sourceThreadId: string | null;
  sourceRole: "root" | "helper" | "unknown";
  sourceItemId?: string;
};
```

`state.result` should only be updated from a root-agent `agentMessage`.

If an `agentMessage` has `actor.role = "helper"`, log it as helper text or an
`agent_completed` event, but do not assign it to `state.result`.

If an `agentMessage` has `actor.role = "unknown"`, there are two possible
policies:

1. Conservative: do not assign it to `state.result`; wait for an attributable
   root message or fail with a clear protocol attribution error.
2. Compatibility: assign it for now, but mark `sourceRole: "unknown"` and emit a
   warning.

The safer long-term behavior is policy 1. A compatibility period may make sense
while learning what Codex app-server actually emits for root messages.

## First-class lifecycle events

Add explicit lifecycle events derived from provider item streams:

```ts
type AgentLifecycleEvent =
  | {
      type: "agent_spawned";
      parentThreadId: string;
      childThreadId: string;
      prompt: string;
      model?: string;
      reasoningEffort?: string;
    }
  | {
      type: "agent_wait_started";
      parentThreadId: string;
      childThreadIds: string[];
    }
  | {
      type: "agent_completed";
      threadId: string;
      parentThreadId: string | null;
      result: string;
    };
```

These events should be in addition to the existing tool cards, not replacements
for raw tool events. The viewer can then render helper lifecycles without
parsing provider-specific `collabAgentToolCall` blobs.

## Viewer API shape

`/api/jobs/:runId` should continue returning raw events, but also return a
derived agent tree and warnings.

```ts
type ViewerJobDetail = {
  run: ViewerJobRun;
  events: ViewerJobLogEvent[];
  agents: ViewerAgentTrace[];
  warnings: ViewerRunWarning[];
};

type ViewerAgentTrace = {
  threadId: string;
  role: "root" | "helper" | "unknown";
  label: string;
  parentThreadId: string | null;
  prompt?: string;
  status: string;
  eventCount: number;
  toolCount: number;
  finalMessage?: string;
  children: string[];
};

type ViewerRunWarning = {
  code:
    | "unknown_actor_events"
    | "helper_result_used_as_done"
    | "done_source_not_root"
    | "zero_page_build"
    | "mcp_used_in_build"
    | "unattributed_done";
  severity: "info" | "warning" | "error";
  message: string;
  eventSequence?: number;
  threadId?: string;
};
```

## Viewer UI proposal

The jobs detail page should become a threaded run viewer, not just a flat
transcript.

Top area:

```text
Run summary
Status: done
Operation: build
Provider: codex
Root thread: 019e...
Pages created: 0
Warnings:
  - Build finished with zero pages
  - 12 tool events had unknown actor
  - Final result source was unknown/helper
```

Controls:

- Segmented filter: `All`, `Main`, `Helpers`, `Unknown`
- Toggle: `Collapse helper traces`
- Toggle: `Show raw JSON`
- Optional search within run transcript

Timeline:

```text
Main
  said: I’ll build this as a first-pass project memory layer...
  tool: rg --files
  spawned Helper 1

  Helper 1
    prompt: inspect Q&A workbooks...
    tool: python xlsx parser
    final: workbook schema notes...

  Helper 2
    prompt: inspect supplements workbook...
    tool: python xlsx parser
    final: supplement schema notes...

Main
  waited for Helper 1, Helper 2
  wrote .almanac/pages/...
  done
```

Unknown ownership should be visible:

```text
Unknown actor
  tool: shell ...
  reason: provider event had no thread id
```

This makes the limitation inspectable instead of hidden.

## Suspicious-run detectors

The viewer and/or process manager should derive warnings from the enriched log.

Suggested detectors:

- `zero_page_build`: operation is `build`, status is `done`, and created/updated
  page count is zero.
- `done_source_not_root`: terminal done event source is helper or unknown.
- `helper_result_used_as_done`: final done result text exactly matches a helper
  final message.
- `unknown_actor_events`: any tool/message event has unknown actor.
- `mcp_used_in_build`: a build/init run contains an MCP tool event.
- `helper_prompt_missing_tooling_boundary`: helper prompt lacks known required
  boundaries such as "no MCP" or "main agent writes final wiki" if we decide to
  lint prompts.

Warnings should appear in:

- `almanac jobs show`
- `almanac jobs attach`
- `almanac serve` jobs detail

## Backward compatibility

Existing JSONL logs are versionless/legacy. The reader should support both:

- Legacy entries: `{ timestamp, event }`
- V2 entries: `{ version: 2, timestamp, sequence, actor, event, raw }`

For legacy logs, derive:

```ts
actor = {
  threadId: null,
  role: "unknown",
  confidence: "unknown",
  label: "Unknown actor"
}
```

The viewer can still render old runs, but should show that ownership is
unavailable.

## Implementation slices

### Slice 1: enrich and preserve

- Add `RunActor` and `RunLogEntryV2` types.
- Add sequence numbers to appended log entries.
- Preserve raw provider item data where useful.
- Keep legacy reader support.
- Do not change viewer layout yet.

### Slice 2: Codex actor extraction

- Track root thread id from `thread/start`.
- Build an agent registry from `collabAgentToolCall`.
- Extract actor fields from every app-server notification/item.
- Emit `unknown` when actor fields are missing.
- Add tests using fake app-server notifications.

### Slice 3: terminal provenance

- Track the source actor for `agentMessage`.
- Only trust root-agent messages as `state.result`, or mark unknown explicitly
  during compatibility mode.
- Add `sourceThreadId` / `sourceRole` to done events.
- Add tests for helper message not overwriting root result.

### Slice 4: viewer derivation

- Update `src/viewer/jobs.ts` to derive `agents` and `warnings`.
- Add unit tests for:
  - root/helper tree construction
  - unknown actor warnings
  - helper result matches done result warning
  - zero-page build warning

### Slice 5: viewer UI

- Update `viewer/jobs-transcript.js` to group by actor.
- Add actor badges and helper nested sections.
- Add filters for main/helpers/unknown.
- Add warning panel to job detail.
- Keep raw event expansion available.

### Slice 6: CLI display

- Update `jobs show` and `jobs attach` to surface warnings.
- Keep concise terminal output, but expose enough to debug without the browser.

## Open questions

1. Does Codex app-server include thread ownership on all item events, or only on
   agent lifecycle events?
2. Are helper `agentMessage` items emitted as normal `agentMessage` items, or
   only embedded inside wait results?
3. Should unknown-origin `agentMessage` be allowed to set `state.result` during
   a compatibility period?
4. Should `build` fail if it ends with zero pages, or only warn in the first
   iteration?
5. Should helper prompts be linted for required inherited boundaries?
6. Should subagent internal transcripts be stored as separate files if the
   provider exposes them, for example:

```text
.almanac/runs/<run-id>.agents/<thread-id>.jsonl
```

The initial recommendation is to keep one enriched JSONL unless provider data
forces a split.

## Recommended next step

Implement slices 1-3 first. That answers the core correctness question:

> Did the root agent end the run, or did a helper/unknown message become the
> final result?

Only after that should we spend time polishing the viewer UI. The current flat
UI is awkward, but the first problem is missing provenance data.

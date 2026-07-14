---
title: Harness Event Shape
topics: [reference, harnesses, agent-runs]
sources:
  - id: harness-events
    type: file
    path: src/codealmanac/services/harnesses/events.py
  - id: harness-results
    type: file
    path: src/codealmanac/services/harnesses/results.py
  - id: harness-actors
    type: file
    path: src/codealmanac/services/harnesses/actors.py
  - id: yoke-events
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/events.py
  - id: yoke-usage-contract
    type: web
    url: https://github.com/AlmanacCode/Yoke/blob/cce337d1c3b80a7fbca8feef4b91db95ae850753/docs/notes/0272-usage-and-generation-control-audit.md
---

# Harness Event Shape

The harness event shape is CodeAlmanac's normalized transcript format for agent runs. Provider adapters convert Codex or Claude event streams into `HarnessEvent` objects, and lifecycle code records those events without parsing provider-specific JSON [@harness-events]. This page defines the event kinds, optional payload groups, tool display fields, usage counters, failures, actor data, and agent traces used by the [harness contract](../architecture/agent-runs/harness-contract).

A harness event always has a `kind` and non-empty `message`. All other fields are optional and depend on what the provider exposed for that event [@harness-events]. The shape is intentionally broad enough for text, tools, token usage, provider sessions, failures, terminal status, and helper-agent activity, so [provider adapters](../architecture/agent-runs/provider-adapters) can add detail without changing lifecycle workflow code.

## Event Kinds

`HarnessEventKind` is the event vocabulary. These values are stable product categories, not raw provider names [@harness-events].

| Kind | Meaning |
|---|---|
| `text_delta` | Incremental assistant text from a provider stream. |
| `text` | A complete text block or message. |
| `tool_use` | A tool call started or was reported. |
| `tool_result` | A tool returned output or an error. |
| `tool_summary` | A compact provider or adapter summary of tool activity. |
| `context_usage` | Token or context-window usage was reported. |
| `provider_session` | Provider session, thread, or turn identity was announced. |
| `warning` | A non-terminal warning occurred. |
| `error` | An error event occurred. |
| `done` | The harness run reached a terminal status. |
| `agent_spawned` | A helper agent or child turn was started. |
| `agent_wait_started` | The root turn began waiting on helper work. |
| `agent_completed` | A helper agent or child turn completed. |

## Event Fields

`HarnessEvent` keeps common event facts at the top level. Providers should fill only the fields they can support honestly [@harness-events].

| Field | Type | Use |
|---|---|---|
| `kind` | `HarnessEventKind` | Required event category. |
| `message` | `str` | Required readable summary; blank text is rejected. |
| `status` | `HarnessRunStatus \| None` | Terminal status for `done` or status-bearing events. |
| `actor` | `HarnessRunActor \| None` | Normalized root/helper attribution. |
| `tool_id` | `str \| None` | Provider or adapter tool-call id. |
| `tool_name` | `str \| None` | Provider tool name. |
| `tool_input` | `str \| None` | Tool input as readable text. |
| `tool_display` | `HarnessToolDisplay \| None` | Structured display metadata for logs. |
| `tool_result` | `JsonValue \| None` | Structured or raw JSON-compatible tool result. |
| `tool_is_error` | `bool \| None` | Whether the tool result represents an error. |
| `usage` | `HarnessUsage \| None` | Token and context usage counters. |
| `provider_session_id` | `str \| None` | Provider session identity. |
| `provider_event_id` | `str \| None` | Provider event identity. |
| `provider_parent_tool_use_id` | `str \| None` | Parent tool id when a provider nests events under a tool use. |
| `source_thread_id` | `str \| None` | Provider thread identity associated with the event. |
| `source_turn_id` | `str \| None` | Provider turn identity associated with the event. |
| `source_role` | `HarnessActorRole \| None` | Root, helper, or unknown role from provider data. |
| `failure` | `HarnessFailure \| None` | Structured failure details. |
| `agent_trace` | `HarnessAgentTrace \| None` | Helper-agent trace metadata. |
| `raw` | `JsonValue \| None` | Raw JSON-compatible provider fragment when useful. |

Optional text fields are validated when present. Empty strings are rejected for tool ids, provider ids, source ids, and other optional text fields [@harness-events].

## Tool Display

`HarnessToolDisplay` is the log-facing summary of a tool call. It separates the provider's raw tool name from the product display category used by jobs and attach streams [@harness-events].

| Field | Type | Use |
|---|---|---|
| `kind` | `HarnessToolDisplayKind \| None` | Display category: `read`, `write`, `edit`, `search`, `shell`, `mcp`, `web`, `agent`, `image`, or `unknown`. |
| `title` | `str \| None` | Human title for the tool action. |
| `path` | `str \| None` | File path when the tool targets a path. |
| `command` | `str \| None` | Shell command when the tool is command-like. |
| `cwd` | `str \| None` | Working directory for command-like tools. |
| `status` | `HarnessToolStatus \| None` | `started`, `completed`, `failed`, or `declined`. |
| `exit_code` | `int \| None` | Process exit code when available. |
| `duration_ms` | `int \| None` | Non-negative duration in milliseconds. |
| `summary` | `str \| None` | Short result summary. |
| `provider_thread_id` | `str \| None` | Provider thread id for tool context. |
| `provider_turn_id` | `str \| None` | Provider turn id for tool context. |

`duration_ms` must be non-negative when present [@harness-events].

## Usage

`HarnessUsage` stores token and context counters. Every counter is optional because providers expose different accounting fields [@harness-events].

| Field |
|---|
| `input_tokens` |
| `cache_creation_input_tokens` |
| `cached_input_tokens` |
| `output_tokens` |
| `reasoning_output_tokens` |
| `total_tokens` |
| `total_processed_tokens` |
| `max_tokens` |

Every usage count must be non-negative when present [@harness-events].

CodeAlmanac preserves Yoke's normalized counters without recomputing them.
Cache creation and cache reads are separate counters for providers such as
Claude; cached input and reasoning output may instead be subsets of broader
input and output counters for providers such as Codex. Consumers must use the
provider-normalized totals rather than summing every field indiscriminately
[@yoke-events] [@yoke-usage-contract].

## Failures

`HarnessFailure` carries structured failure information for an event. It records the provider kind, required message, optional fix, optional code, optional raw text, and optional JSON-compatible details [@harness-events].

The failure `message` is required and cannot be blank. Optional text fields are also rejected when they are present but blank [@harness-events].

## Actors And Agent Traces

Actor attribution is represented by `HarnessRunActor`. Its `role` is `root`, `helper`, or `unknown`; its `confidence` is `provider`, `derived`, or `unknown`; and it may also include thread id, parent thread id, and label [@harness-actors].

Helper-agent metadata is represented by `HarnessAgentTrace`. It may include parent thread id, one child thread id, multiple child thread ids, prompt, model, reasoning effort, and result text [@harness-events]. Child thread ids must be non-empty strings, and optional trace text is validated when present [@harness-events].

## Result Relationship

`HarnessRunResult` stores the full event stream as `events: tuple[HarnessEvent, ...]` beside the terminal status, output text, changed files, and transcript reference [@harness-results]. A terminal helper can create a fallback `done` event whose message is built from provider kind, terminal status, and the first output line [@harness-results].

That relationship matters for lifecycle runs: the result gives terminal status one stable object, while the event stream gives logs and attach views a provider-neutral transcript. New adapters should satisfy this event shape before linking into the broader harness contract; see [add a harness provider adapter](../guides/add-a-harness-provider-adapter).

---
page_id: reference-harness-events
title: Harness Events
summary: This page lists the normalized event kinds and major fields used by provider harnesses.
topics: [reference, lifecycle, integration]
sources:
  - id: harness-events
    type: file
    path: src/codealmanac/services/harnesses/events.py
  - id: harness-results
    type: file
    path: src/codealmanac/services/harnesses/results.py
---

# Harness Events

Harness events are provider-neutral records of agent execution. They can describe text, text deltas, tool calls, tool results, usage, provider sessions, warnings, errors, completion, and helper-agent traces. [@harness-events]

## Event kinds

| Kind | Meaning |
|---|---|
| `text_delta` | Streaming text fragment. |
| `text` | Complete text message. |
| `tool_use` | Tool call started or observed. |
| `tool_result` | Tool result observed. |
| `tool_summary` | Tool summary event. |
| `context_usage` | Token or context usage. |
| `provider_session` | Provider session identifier. |
| `warning` | Non-terminal warning. |
| `error` | Error event. |
| `done` | Completion event. |
| `agent_spawned` | Helper agent started. |
| `agent_wait_started` | Root agent started waiting for helper work. |
| `agent_completed` | Helper agent completed. |

These kinds are defined by `HarnessEventKind`. [@harness-events]

## Related pages

Harness run results carry readiness, transcript references, run status, terminal helper events, and changed-file information alongside normalized events. [@harness-results]

Read `[[architecture-harness-system]]`, `[[architecture-codex-harness]]`, and `[[architecture-claude-harness]]`.

# Yoke-native agent packages

## Live agreement

- Build, ingest, and garden are named agents in one packaged Yoke collection.
- Their stable behavior lives in Yoke `instructions.md`, not Python pipelines.
- Each run supplies only typed runtime context as the task prompt.
- Yoke and the native harness own skills, declared subagents, workflows, and
  provider lowering. CodeAlmanac owns product requests, persistence, and display.
- Native agents remain trusted; prompt policy is not duplicated as enforcement.

## Ownership map

| Owner | Responsibility |
| --- | --- |
| `agents/<name>/` | Stable instructions, tools, permissions, future Yoke capabilities |
| lifecycle workflow | Typed run-specific repository/source/health context |
| Yoke adapter | Agent selection, provider binding, event/result projection |
| Yoke | Provider surfaces, environment, skills, subagents, sessions, normalized events |
| runs transcript | Durable human-readable CLI/viewer projection |

## Product debt removed

- The generic prompt renderer and closed prompt-name enum are deleted.
- Workflows no longer assemble static agent identity on every run.
- Canonical wiki pages no longer teach deleted Claude/Codex implementations.

## Extension rule

Add `skills/`, `subagents/`, or `workflows/` beneath an agent only when the
capability has a durable product identity. Do not add CodeAlmanac manifests or
orchestration code parallel to Yoke's folder contract.

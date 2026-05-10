# V1 Decision Log

This log records design choices and tradeoffs during the V1 harness/process
refactor.

## 2026-05-10 Branch And Plan Setup

Decision: Use branch `v1` for the rewrite.

Context: User requested a new branch named `v1` if available, otherwise an
alternate such as `v2`. Local/remote `v2` already existed; `v1` was free.

Alternatives:
- Use existing `v2`.
- Use a prefixed branch such as `codex/v1`.

Why: The user explicitly asked for the `v1`/`v2` naming scheme. `v1` was
available and clearer for this rewrite.

Consequences: Branch `v1` now tracks `origin/v1`.

## 2026-05-10 Planning Scope

Decision: Treat this as a breaking architecture rewrite, not an incremental
compatibility refactor.

Context: User stated no one is using the codebase and asked not to preserve old
architecture just to fit existing code.

Alternatives:
- Incrementally adapt current `bootstrap` and `capture`.
- Keep hardcoded writer/reviewer and wrap it with new names.

Why: The new architecture requires clean boundaries: operations, process
manager, harness SDK, provider adapters, and simple prompt assembly.

Consequences: Implementation should delete stale architecture where it conflicts
with the new model.

# Slice 85: Claude Event Mapper Boundaries

## Scope

Refactor the Claude SDK event normalization code from one large provider file
into smaller modules with explicit responsibilities.

This slice changes internal integration structure only. It must not change the
`HarnessAdapter` port, public CLI behavior, run-log semantics, SDK options, or
normalized event payload shape.

## Why now

Slice 84 restored the Claude SDK/event harness behavior, but
`src/codealmanac/integrations/harnesses/claude/events.py` grew to 693 lines.
That is too much responsibility for one provider-boundary file and makes future
SDK-event fixes harder to review.

Cosmic Python chapter 4 keeps the use case in the service layer; this refactor
keeps the service-facing `HarnessAdapter` unchanged and only improves the
external message adapter internals. Cosmic Python chapter 13 says "Explicit is
better than implicit"; the Claude SDK edge keeps its dependencies explicit and
does not hide provider state behind the CLI or service layer.

## Shape

```text
integrations/harnesses/claude/
  events.py          # dispatch one SDK message to the right mapper
  sdk_messages.py    # SDK union type and session-id extraction
  state.py           # mutable ClaudeRunState
  actors.py          # root/helper actor attribution
  result.py          # final result, done event, usage event
  message_events.py  # assistant/user/result message mapping
  stream.py          # stream delta mapping
  tool_events.py     # tool block mapping and helper-agent tool traces
  task_events.py     # SDK task lifecycle message mapping
  raw.py             # raw SDK dataclass to JSON-compatible value
```

## Design decisions

- Keep SDK dataclass `isinstance` checks. Do not use dynamic attribute access.
- Keep raw provider payload conversion as opaque external passthrough.
- Add an architecture guard that fails if any Claude harness module grows into
  another large provider monolith.
- Preserve current tests as behavior coverage; add only architecture coverage
  unless the split reveals a missing behavioral test.

## Out of scope

- Live Claude or Codex model calls.
- Public CLI changes.
- Event schema changes.
- Adding support for structured final outputs.

## Verification

- `uv run pytest tests/test_claude_adapter.py tests/test_architecture.py`
- `uv run ruff check src/codealmanac/integrations/harnesses/claude tests/test_claude_adapter.py tests/test_architecture.py`
- `uv run pytest`
- `uv run ruff check .`
- `git diff --check`

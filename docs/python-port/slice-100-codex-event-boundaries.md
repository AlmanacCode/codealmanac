# Slice 100: Codex Event Boundaries

## Scope

Split `src/codealmanac/integrations/harnesses/codex/events.py` by provider-edge
responsibility. The Codex app-server harness is now the default lifecycle path,
and its event mapper should not remain a single 460-line module while the Claude
SDK mapper has explicit event-boundary modules.

This slice changes internal Codex integration structure only. It must not change
the `HarnessAdapter` port, public CLI behavior, app-server JSON-RPC startup,
run-log semantics, or normalized `HarnessEvent` payload shape.

## Why Now

The live agreement says the inspectable transcript surface is a normalized
CodeAlmanac event stream and that Codex should use app-server events. The
current mapper mixes notification dispatch, run state, actor attribution, item
completion, helper-agent lifecycle events, usage text, provider-session events,
and base64 output decoding in one file.

Cosmic Python chapter 13 quotes the Zen line "Explicit is better than implicit."
This split makes provider-edge dependencies explicit: app-server transport keeps
using the same mapper entrypoints, while event responsibilities move into named
modules.

## Shape

```text
integrations/harnesses/codex/
  events.py        # dispatch one app-server notification
  state.py         # mutable CodexRunState
  actors.py        # root/helper actor attribution and labels
  item_events.py   # item/completed and output-delta mapping
  agent_events.py  # spawn/wait helper-agent lifecycle traces
  result.py        # provider-session, usage, turn completion, done event
```

## Design Decisions

- Keep `map_codex_notification`, `CodexRunState`, `provider_session_event`, and
  `done_event` importable from `codex.events` for the current app-server client
  call sites.
- Do not add provider abstractions below `HarnessEvent`; these are Codex
  app-server adapters, not domain services.
- Add an architecture guard that keeps Codex harness modules small and prevents
  the dispatch module from regrowing item, actor, result, or agent-trace logic.
- Preserve current app-server tests as behavior coverage. Add only architecture
  coverage unless the split exposes missing behavior.

## Files

- `src/codealmanac/integrations/harnesses/codex/events.py`
- `src/codealmanac/integrations/harnesses/codex/state.py`
- `src/codealmanac/integrations/harnesses/codex/actors.py`
- `src/codealmanac/integrations/harnesses/codex/item_events.py`
- `src/codealmanac/integrations/harnesses/codex/agent_events.py`
- `src/codealmanac/integrations/harnesses/codex/result.py`
- `tests/test_architecture.py`
- Steering docs under `docs/python-port/`

## Verification

- `uv run pytest tests/test_codex_app_server_adapter.py tests/test_codex_adapter.py tests/test_architecture.py`
- `uv run ruff check src/codealmanac/integrations/harnesses/codex tests/test_codex_app_server_adapter.py tests/test_codex_adapter.py tests/test_architecture.py`
- `uv run pytest`
- `uv run ruff check .`
- `git diff --check`

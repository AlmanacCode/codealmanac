# Slice 84: Claude SDK Harness Events

## Scope

Replace the thin Claude CLI JSON run path with a Claude Agent SDK client that
streams provider messages into CodeAlmanac `HarnessEvent` records.

This is an integration slice. It should not change workflow ownership,
page-run lifecycle semantics, run storage, or CLI command behavior.

## Why now

`docs/python-port-live-agreement.md` says the inspectable transcript surface is
the normalized CodeAlmanac harness event stream and that Claude should use the
richer SDK/event harness, not only the one-shot CLI print path.

Cosmic Python chapter 4 frames the service layer as the place that defines
"the use cases of our system." For this slice, the use case stays
`HarnessesService.run(request)`. The SDK is only a provider detail.

Cosmic Python chapter 13 argues for explicit dependencies and says
"Explicit is better than implicit." The Claude query function should therefore
be injected into the SDK client so tests can feed typed SDK messages without
monkeypatching global imports.

## Shape

```python
ClaudeSdkHarnessAdapter.run(request)
  before = git_status_snapshot(...)
  result = ClaudeSdkClient(query=claude_agent_sdk.query).run(request)
  after = git_status_snapshot(...)
  return result.with_changed_files(...)

ClaudeSdkClient.run(request)
  return asyncio.run(self._run(request))

ClaudeSdkClient._run(request)
  options = ClaudeAgentOptions(...)
  async for message in query(prompt=request.prompt, options=options):
      state.note_session(message)
      events.extend(map_claude_message(message, state))
      state.record_result(message)
  events.append(done_event(state))
  return result_from_state(state, events)
```

## Design decisions

- Add `claude-agent-sdk` as an internal runtime dependency.
- Keep `HarnessAdapter` as the service-owned port.
- Keep readiness probing through `claude auth status` for now, but report
  `ANTHROPIC_API_KEY` as ready when it exists.
- Use SDK dataclass types with `isinstance`; do not parse final text for
  lifecycle state.
- Isolate Claude user/project/local settings with `setting_sources=[]` and
  `strict_mcp_config=True`.
- Use `permission_mode="dontAsk"` with the same local editing/search tool set
  the archive allowed.
- Emit provider session, text delta, text, tool use, tool result, tool summary,
  context usage, error, done, and helper-agent trace events where the SDK
  exposes enough structure.

## Out of scope

- Public Python SDK or MCP surface.
- Hosted/cloud capture.
- Structured final output schemas.
- Real paid Claude model dogfood unless credentials and cost are explicitly
  accepted.
- Changing the default lifecycle harness away from Codex.

## Files

- `pyproject.toml`, `uv.lock`
- `src/codealmanac/integrations/harnesses/claude/`
- `src/codealmanac/integrations/harnesses/__init__.py`
- `tests/test_claude_adapter.py`
- new Claude SDK client/event tests if they read clearer than one large test
- `docs/python-port-live-agreement.md`
- `docs/python-port/next-agent-brief.md`
- `docs/python-port/verification-matrix.md`
- `docs/python-port/worklog.md`

## Verification

- `uv run pytest tests/test_claude_adapter.py`
- `uv run pytest tests/test_harnesses_service.py tests/test_ingest_workflow.py::test_ingest_workflow_records_normalized_harness_events`
- `uv run ruff check src/codealmanac/integrations/harnesses/claude tests/test_claude_adapter.py`
- `uv run pytest`
- `uv run ruff check .`
- `git diff --check`

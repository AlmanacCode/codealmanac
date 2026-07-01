# Slice 137: Real Claude SDK Dogfood

## Goal

Prove the default Claude lifecycle harness against the installed real
`claude-agent-sdk` / Claude CLI path, or fix the first concrete mismatch it
exposes.

## Why This Slice

The live agreement says the default Claude lifecycle harness uses
`claude-agent-sdk` with isolated options and normalized provider events. Slice
84 verified that shape with typed fake SDK streams, and at slice start the
next-agent brief still said no paid real-Claude SDK dogfood had run. Local
`claude auth status` reported a logged-in first-party account, so the real
provider path could be tested.

Cosmic Python chapter 13 supports this test shape: use the composition root with
explicit dependencies instead of driving the CLI when the goal is provider
runtime proof with controlled CodeAlmanac state. The dogfood uses
`create_app(AppConfig(registry_path=<tmp>))` so the CodeAlmanac registry stays
isolated while real HOME remains available for Claude authentication.

## Architecture

Use the real application composition and real Claude SDK provider:

```python
app = create_app(AppConfig(registry_path=temp_registry))
app.workflows.build.initialize(InitializeWorkspaceRequest(path=temp_repo))
result = app.workflows.ingest.run(
    RunIngestRequest(
        cwd=temp_repo,
        inputs=("notes/design.md",),
        harness=HarnessKind.CLAUDE,
        guidance="...",
    )
)
```

Responsibility split:

- `app.py` composes the real Claude SDK harness.
- `IngestWorkflow` drives the lifecycle.
- `ClaudeSdkClient` owns SDK options, stream consumption, and timeout handling.
- Claude provider modules own SDK message normalization.
- Run logs, search, show, and health prove the normalized event surface.

## Scope

In scope:

- Run a temp-repo real Claude SDK ingest with a tiny source note.
- Inspect `jobs logs`, `search`, `show`, and `health`.
- Update the verification matrix, next-agent brief, release docs, and worklog
  with exact evidence.
- Patch code only for a concrete provider mismatch.

Out of scope:

- Prompt-quality broad evaluation.
- More provider transports.
- Hosted/cloud behavior.
- CLI registry override design.

## Verification

Focused if code changes:

```bash
uv run pytest tests/test_claude_adapter.py
```

Dogfood:

```bash
uv run python <temp real-claude-ingest script>
```

Full gate before commit:

```bash
uv run pytest
uv run ruff check .
git diff --check
```

## Outcome

The real Claude SDK dogfood passed through the service-level composition root
without code changes.

Run facts:

- Temp repo:
  `/var/folders/v2/f289rp_d0_118wk72xtvtp5r0000gn/T/codealmanac-real-claude-s3_gt7ls/repo`
- Temp registry:
  `/var/folders/v2/f289rp_d0_118wk72xtvtp5r0000gn/T/codealmanac-real-claude-s3_gt7ls/registry.json`
- Run id: `ingest-20260701163930-cf193a0e`
- Final status: `done`
- Harness status: `succeeded`
- Event count: 73
- Event kinds: `provider_session`, `text`, `text_delta`, `tool_use`,
  `tool_result`, `context_usage`, `warning`, `done`
- Pages after run: `getting-started.md`, `release-package-smoke.md`
- Search proof: `release-package-smoke`
- Health: all reported counts were zero, including graph and source findings.

This proves the installed `claude-agent-sdk` / Claude CLI auth path can drive a
full local Ingest lifecycle through the default Python Claude harness, using the
normalized harness event stream as the inspectable transcript surface.

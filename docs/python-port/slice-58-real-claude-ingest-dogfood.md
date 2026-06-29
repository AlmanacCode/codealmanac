# Slice 58 - Real Claude Ingest Dogfood

Date: 2026-06-29

## Purpose

Prove the second supported lifecycle provider against a real local wiki before
public release.

## Scope

- Run `IngestWorkflow` with the real `ClaudeCliHarnessAdapter`.
- Keep the workspace registry isolated in a temp home.
- Let Claude use the real local login state.
- Verify the generated wiki through service health and public CLI commands.
- Patch only issues exposed by dogfood.

## Dogfood Shape

The dogfood used a temp Git repo with a clean committed baseline:

- `almanac/` initialized by the Python build workflow.
- `notes/incident-window.md` as selected source material.
- a temp registry path at `<temp-home>/.almanac/registry.json`.
- real Claude auth from the local machine.

The call shape stayed at the service boundary:

```python
app = create_app(
    AppConfig(registry_path=temp_home / ".almanac" / "registry.json"),
    harness_adapters=(ClaudeCliHarnessAdapter(),),
)
app.workflows.build.initialize(InitializeWorkspaceRequest(path=repo))
app.workflows.ingest.run(
    RunIngestRequest(
        cwd=repo,
        inputs=("notes/incident-window.md",),
        harness=HarnessKind.CLAUDE,
    )
)
```

This matches the Cosmic Python service-layer and composition-root pattern:
entrypoints are driving adapters, workflows own use cases, and provider CLIs
stay behind integration adapters.

## Evidence

Claude readiness was available through `claude auth status`.

The real run completed with:

- run id `ingest-20260629230850-d1048550`
- created page `almanac/pages/incident-window-policy.md`
- updated `almanac/topics.yaml`
- `search deploy` returned `incident-window-policy`
- `health` reported no broken links, dead refs, empty topics, or empty pages
- `jobs logs` recorded lifecycle events and the provider output event

The generated page had one clear subject, no dangling page links, and preserved
the source note's decision, invariant, rejected alternative, and reason.

## Public CLI Check

The same temp repo passed:

```text
codealmanac jobs logs ingest-20260629230850-d1048550
codealmanac search deploy
codealmanac show incident-window-policy
codealmanac health --json
```

The CLI output showed the run log, returned the generated page, rendered the
page body, and reported a clean health JSON object.

## Result

No code or prompt fix was needed. Real Codex and real Claude ingest now both
have release-gate evidence. The next high-pressure release gate is real sync
against a local transcript, including second-run skip proof.

## Relayforge Note

The Cosmic Python service-layer lesson was sent to Discord through Relayforge
using Doppler `almanac/dev` and binding `rohan-almanac-main`.


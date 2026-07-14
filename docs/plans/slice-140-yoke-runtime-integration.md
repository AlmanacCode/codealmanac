# Slice 140: Yoke runtime integration

## Outcome

CodeAlmanac delegates provider execution to the public `almanac-yoke` SDK while
retaining exact lifecycle prompts, durable run records, job-log JSON, wiki
mutation safety, and CLI behavior.

## Architecture agreement

```text
Build / Ingest / Garden
    -> OperationRunner
    -> HarnessesService (CodeAlmanac product port)
    -> YokeHarnessAdapter
    -> yoke.Harness
    -> Claude SDK or Codex app-server

yoke Readiness / Event / Run
    -> explicit projection
    -> CodeAlmanac persisted harness models
    -> run ledger and viewer
```

CodeAlmanac owns product prompts, operation policy, run persistence, rendering,
and post-run wiki validation. Yoke owns provider authentication, execution,
permissions, sessions, model forwarding, and raw provider normalization.

The CodeAlmanac harness models remain a persistence projection. They prevent a
third-party SDK model from silently changing database/API JSON. They must not
grow provider parsing or execution logic.

## Prompt contract

The root Yoke agent is description-only. It has no instructions, goal, skills,
or declared subagents. The fully rendered CodeAlmanac prompt crosses the Yoke
boundary as the run prompt without modification. Claude therefore receives no
Yoke system prompt and Codex receives no developer instructions.

Codex explicitly uses `codex_app_server`. Claude intentionally uses Yoke's
default Claude surface so the SDK can evolve its recommended native path.

## Scope

- Add `almanac-yoke` as the provider runtime dependency.
- Replace both provider-specific integration trees with one Yoke adapter and
  one projection module.
- Preserve the existing service-owned harness port and lifecycle call sites.
- Preserve the words in the packaged prompt resources and forward each rendered
  prompt without adding Yoke instructions.
- Preserve provider model, tool, permission, timeout, and ephemeral-session
  behavior intentionally rather than inheriting SDK defaults accidentally.
- Replace provider-parser tests with Yoke boundary/projection tests.
- Live-test build, ingest, and garden across both providers, alongside direct
  sessions, workflows, skills, subagents, models, and failures.
- Delete direct Claude SDK and Codex app-server machinery from CodeAlmanac.

## Out of scope

- Replacing CodeAlmanac's durable run ledger with Yoke's optional run store.
- Moving operation prompts or wiki validation into Yoke.
- Exposing arbitrary Yoke providers/surfaces as new CLI configuration.
- Changing prompt prose or CLI output.

## Verification

- Prompt content and boundary-forwarding tests.
- Projection coverage for every Yoke event/status/tool/usage/agent/failure
  shape consumed by CodeAlmanac.
- A focused service/integration ownership boundary without file-layout tests.
- Existing CodeAlmanac suite and Ruff gate.
- Clean wheel install and package-resource tests.
- Real Claude and Codex lifecycle runs in isolated repositories.
- Rebase onto current `origin/main`, repeat gates, merge, publish, and verify a
  fresh PyPI installation.

## Read before coding

- `MANUAL.md`
- `docs/python-port-live-agreement.md`
- `almanac/architecture/agent-runs/harness-contract.md`
- `almanac/architecture/agent-runs/provider-adapters.md`
- `almanac/architecture/lifecycle/operation-runner.md`
- Yoke `README.md`, `docs/reference.md`, and public models/options

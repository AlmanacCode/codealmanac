# Slice 141: Native Yoke agent runtime

## Outcome

CodeAlmanac's three packaged Yoke agents run through Yoke 0.1.7's native,
ephemeral provider compilation without changing their instruction text or
writing provider configuration into a repository.

## Architecture

```text
LocalStatePaths.harness_runtime_dir
    -> default_harness_adapters(runtime_root)
    -> YokeHarnessAdapter(runtime_root)
    -> yoke.Harness(runtime_root=..., agent=load_agent(kind))
    -> Codex named roles / Claude AgentDefinition and plugin skills
```

CodeAlmanac owns the build, ingest, and garden agent folders, operation
prompts, durable run ledger, and Yoke event projection. Yoke owns provider
resource derivation, native subagent and skill lowering, provider sessions,
and cleanup. The integration must not create `.codex` or `.claude` inside the
target repository and must not reimplement provider compilation.

## Scope

- Require `almanac-yoke[claude]>=0.1.7,<0.2`.
- Give Yoke a product-owned cache parent under CodeAlmanac local state.
- Preserve the exact packaged agent instruction files.
- Prove build, ingest, and garden still load as Yoke folder agents.
- Prove the production composition root passes the configured local-state
  directory to both provider adapters.
- Live-test packaged agents on Codex and Claude, including native skills and
  subagents where the provider supports them.

## Out Of Scope

- Moving CodeAlmanac's durable run storage into Yoke.
- Adding provider-specific compilation code to CodeAlmanac.
- Changing lifecycle prompt prose or operation policy.
- Adding speculative CodeAlmanac helper agents or skills without a product job.

## Verification

- Focused Yoke adapter and composition-root tests.
- Full `uv run pytest` and `uv run ruff check .`.
- Clean wheel and sdist installation smoke tests.
- Real CodeAlmanac lifecycle jobs on Codex and Claude in temporary repositories.
- Runtime cleanup and absence of repository-local provider folders.

## Read Before Coding

- `MANUAL.md`
- `docs/python-port-live-agreement.md`
- `docs/reference/cosmic-python/chapter_04_service_layer.md`
- `docs/reference/cosmic-python/chapter_13_dependency_injection.md`
- `docs/plans/slice-140-yoke-runtime-integration.md`
- Yoke 0.1.7 `README.md` and `docs/reference.md`

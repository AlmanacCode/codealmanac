---
title: Provider Lifecycle Boundary
summary: CodeAlmanac separates runtime execution providers from agent readiness, auth, instruction, and config support so one provider name does not imply one lifecycle.
topics: [agents, systems, decisions]
files:
  - src/harness/types.ts
  - src/harness/providers/
  - src/agent/types.ts
  - src/agent/readiness/
  - src/agent/auth/claude.ts
  - src/agent/instructions/codex.ts
  - src/agent/install-targets.ts
  - src/commands/agents.ts
  - src/commands/setup.ts
  - src/commands/setup/
  - src/commands/doctor-checks/agents.ts
  - src/process/manager.ts
  - src/config/index.ts
sources:
  - docs/plans/2026-05-14-provider-automation-boundary-refactor.md
  - /Users/rohan/.config/superpowers/worktrees/codealmanac/long-term-arch-cleanup/docs/plans/2026-05-14-long-term-architecture-cleanup.md
  - /Users/rohan/.codex/sessions/2026/05/13/rollout-2026-05-13T23-00-06-019e246d-595d-76d3-bd45-6433245065ac.jsonl
  - /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T12-03-51-019e273a-e4b1-7510-981d-d1deb31bc8e2.jsonl
  - /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T12-11-57-019e2742-4c9c-7241-8ccd-a6d36a889d7d.jsonl
  - /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T13-38-45-019e2791-c776-7f62-a6fc-25a8f07c6a6e.jsonl
  - /Users/rohan/Desktop/Projects/t3code/packages/contracts/src/providerInstance.ts
  - /Users/rohan/Desktop/Projects/t3code/apps/server/src/provider/ProviderDriver.ts
  - /Users/rohan/Desktop/Projects/t3code/apps/server/src/provider/Services/ProviderRegistry.ts
  - /Users/rohan/Desktop/Projects/t3code/apps/server/src/provider/Services/ProviderAdapterRegistry.ts
status: active
verified: 2026-05-14
---

# Provider Lifecycle Boundary

CodeAlmanac has one runtime provider boundary and several agent-support boundaries. [[harness-providers]] executes Build, Absorb, Garden, and other lifecycle operations from `AgentRunSpec`. `src/agent/readiness/` builds installed/authenticated/model-choice status for setup, `almanac agents`, and doctor. `src/agent/auth/claude.ts` owns Claude executable and auth probing shared by readiness and runtime. `src/agent/instructions/codex.ts` owns Codex AGENTS-file writing because that is instruction installation, not readiness or execution.

The pre-cleanup tree had two provider-shaped areas: `src/harness/providers/` and `src/agent/providers/`. That was a structural smell because a maintainer could reasonably ask which one was the real provider system. The durable decision was not to delete setup/status behavior, and not to merge every concern into the harness. The durable decision was to separate lifecycles while keeping provider identity narrow and shared where needed.

A 2026-05-14 review found the same smell still present after the old provider `run()` methods were removed: `AgentProviderMetadata` and `AgentProviderCapabilities` in `src/agent/types.ts` still describe runtime facts such as transport, file writes, streaming, usage, cost, subagents, and strict tool allowlists. Those fields duplicate `src/harness/providers/metadata.ts` and can drift from the actual execution adapters. The setup/status layer should keep readiness facts such as display name, executable, status, auth state, and model choices; runtime capabilities should come from [[harness-providers]] metadata or a shared catalog that the harness owns for execution.

A follow-up review of the provider-automation boundary refactor accepted the provider side of that cleanup when `src/agent/types.ts` no longer exposed runtime capability metadata and the harness metadata remained the source for execution capabilities. That review also kept the setup/status layer's remaining facts narrow: provider id, display name, default model, executable, installed/authenticated status, and model-choice data.

## Current execution path

Current operation execution goes through `src/process/manager.ts`, which calls `getHarnessProvider(spec.provider.id).run(...)`. `src/harness/types.ts` defines `AgentRunSpec`, `HarnessProvider`, `HarnessEvent`, and related execution types. This is the path that owns provider runtime behavior such as SDK or CLI protocol mapping, event normalization, sandbox policy, tool mapping, subagent support, request timeouts, and usage reporting.

No production code path found in the 2026-05-14 review called `getAgentProvider(...).run(...)` for lifecycle operation execution. The old `AgentProvider.run()` surface in `src/agent/types.ts` is therefore obsolete unless future tests or hidden callers prove otherwise.

## Current agent-support path

`src/agent/readiness/view.ts` uses provider status checks and model choices to build setup, agents, and doctor views. `src/commands/agents.ts`, `src/commands/setup.ts`, and `src/commands/doctor-checks/agents.ts` depend on that projection. Provider-specific readiness checks live under `src/agent/readiness/providers/` and answer only setup/status questions.

That setup/status responsibility is distinct from execution. It answers questions such as whether a provider CLI is installed and authenticated, which model choices should be shown, which fix command should be printed, and which provider-specific instruction files setup should write. Those are agent readiness concerns, not per-run execution concerns.

The setup/status path is also distinct from persisted config. `src/config/index.ts` owns global config including `agent.default`, `agent.models`, update notifier state, and automation state. `src/commands/config.ts` and `src/commands/config-keys.ts` expose config keys, `src/commands/setup.ts` orchestrates first-run choices, and `src/commands/agents.ts` manages agent choice and model choice after setup. Setup is a workflow over config, readiness, automation, and guide installation; it should not become the home for reusable provider readiness logic.

## Cleanup target

The cleanup target is a refactor slice, not a rewrite. The target shape is:

- one shared provider catalog for ids, display names, defaults, and any model catalog that should be shared
- one execution adapter layer under `src/harness/providers/`
- one agent readiness or agent config layer for installed/authenticated/model-choice state used by setup, agents, and doctor commands
- one config module for persisted user config, replacing the misleading old `src/update/config.ts` ownership
- neutral auth or status helpers where both execution and setup need the same provider-specific facts

The 2026-05-14 refactor identified the old execution surface in `src/agent/providers/` as deletion scope: `AgentProvider.run`, `RunAgentOptions`, `AgentResult`, `jsonl-cli.ts`, `prompt.ts`, and old Claude/Codex/Cursor `run()` implementations. Setup views, `almanac agents`, setup, doctor checks, model choices, and instruction installation should stay, but they should depend on setup/status primitives rather than an alternate runtime abstraction.

The 2026-05-14 refactor plan uses `src/config/` for global config, `src/agent/catalog.ts` for provider identity when shared provider facts need a separate home, `src/agent/readiness/` for installed/authenticated/model-choice state, and `src/harness/providers/` for execution adapters. `src/setup/providers/` would only be accurate if the code existed solely for `almanac setup`; current consumers include `almanac agents` and `almanac doctor`, so a setup-owned path would hide those dependencies.

The follow-up cleanup branch made the next boundary sharper. `src/agent/providers/` disappeared as an internal path once the remaining readiness code moved under `src/agent/readiness/providers/`; keeping that old directory after it stopped executing agents preserved the stale provider mental model. The same cleanup deleted the internal compatibility shims `src/agent/provider-view.ts` and `src/update/config.ts` after production imports and tests moved to `src/agent/readiness/view.ts` and `src/config/index.ts`.

A later code review found two limits on that `src/agent/readiness/` destination. Claude executable resolution and auth probing are shared runtime facts when the harness adapter and doctor/setup status both need them; those helpers live in `src/agent/auth/claude.ts`, not under readiness. Codex AGENTS-file writing is instruction-install behavior, not provider readiness; the instruction writer lives in `src/agent/instructions/codex.ts`, even though setup, doctor, and uninstall may all call it.

`src/commands/setup.ts` was the next provider-adjacent cohesion risk. It orchestrated global install handling, provider/model selection, instruction-guide installation, automation setup, config writes, prompt/output flow, and path resolution. The cleanup kept `setup.ts` as the CLI wrapper and moved named workflow steps into `src/commands/setup/` modules: provider/model choice, durable global install handling, automation setup, guide installation, auto-commit config, next-step rendering, guide path resolution, and terminal output. That preserves setup as one user-facing command while preventing setup from becoming the owner of reusable provider readiness, config, guide, and automation behavior.

The same follow-up plan explicitly rejects a generic "automate anything" framework for now. Current automation has two real scheduled tasks, `capture-sweep` and `garden`; `src/automation/tasks.ts` can become more explicit for those known tasks, but a broader operation/coordinator automation abstraction should wait for a third concrete scheduled task or product surface.

The neighboring `t3code` project supports this direction but is intentionally heavier than CodeAlmanac needs. Its provider model separates driver kind from configured provider instance id, materializes instances through a `ProviderDriver`, exposes install/auth/model snapshots through `ProviderRegistry`, and routes runtime work through `ProviderAdapterRegistry`. CodeAlmanac does not currently need multi-instance providers, hot-reload, unavailable shadow instances, or scoped per-instance runtime lifecycles, but the smaller lesson applies: provider identity/config, user-facing status snapshots, and runtime adapters should be separate concepts.

## Transcript discovery is separate

Claude and Codex transcript scanning for scheduled capture is provider-specific source discovery, not harness provider execution and not harness history. External transcript stores under `~/.claude/projects/` and `~/.codex/sessions/` can contain ordinary user work outside CodeAlmanac's own lifecycle runs. That code should move out of command files into a capture-domain discovery module, but it should not be folded into `src/harness/providers/` unless the harness contract is intentionally expanded to own provider app history.

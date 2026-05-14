# Long-Term Architecture Cleanup

Branch: `codex/long-term-arch-cleanup`

## Goal

Finish the architectural cleanup after the provider/automation boundary refactor. The target is a codebase where directory names match responsibilities, compatibility shims do not preserve stale mental models, and `setup` is no longer a single command file that owns unrelated onboarding steps.

## Current Smells

- `src/agent/providers/` now contains setup/status/model readiness code, but the path still reads like an execution provider layer.
- `src/agent/provider-view.ts` and `src/update/config.ts` are compatibility re-exports that preserve old module names after internal code moved.
- `src/commands/setup.ts` still owns setup flow, provider choice, global package install, guide install, automation install, config writes, output helpers, and path resolution.
- Older docs and wiki pages still mention old paths such as `src/agent/provider-view.ts` and `src/update/config.ts`.
- Automation is cleaner, but the task registry can still be made more explicit without building an abstract "automate anything" framework prematurely.

## Design

### Provider Readiness

Move remaining readiness provider code under `src/agent/readiness/providers/`.

Target:

```text
src/agent/readiness/
  view.ts
  providers/
    index.ts
    status.ts
    cli-status.ts
    codex-cli.ts
    cursor-cli.ts
    codex-instructions.ts
    claude/
      index.ts
      auth.ts
```

The old `src/agent/providers/` path should disappear from production and tests unless a public deep import absolutely requires a shim. Internal tests should import the new path.

### Compatibility Shims

Delete `src/agent/provider-view.ts` and `src/update/config.ts` after updating tests and production imports. This is an internal TypeScript source tree; keeping old deep-import shims makes future agents keep finding and citing obsolete homes.

### Setup Modules

Keep `src/commands/setup.ts` as the CLI-facing orchestrator, but move implementation slices into `src/commands/setup/`:

```text
src/commands/setup/
  output.ts              # banner, badge, step rendering, prompts
  agent-choice.ts        # provider/model selection and config write input
  automation-step.ts     # scheduler installation step
  guides-step.ts         # Claude/Codex guide installation step
  auto-commit-step.ts    # auto_commit config step
  global-install-step.ts # ephemeral npx durable install step
```

The setup command should read as a workflow over named steps. Each step can still use the existing output style and return the same `SetupResult` behavior.

### Automation Task Registry

Do not create a generic operation automation framework yet. Instead, make the existing `src/automation/tasks.ts` registry explicit enough that adding a third scheduled Almanac task would not require copying plist knowledge into the command file.

### Documentation

Update active wiki pages and relevant plan text that points to old module locations. Avoid rewriting historical plans unless a stale path is directly harmful; prefer active wiki pages and current "where to edit" guidance.

## Validation

- Focused tests after provider readiness moves:
  - `npm test -- --run test/provider-view.test.ts test/agents-command.test.ts test/setup.test.ts test/doctor.test.ts test/auth.test.ts`
- Focused tests after setup extraction:
  - `npm test -- --run test/setup.test.ts test/uninstall.test.ts test/doctor.test.ts test/automation.test.ts`
- Full validation before push:
  - `npm run build`
  - `npm test`
  - `git diff --check`

## Commit Strategy

Commit after each stable slice:

1. plan/log checkpoint
2. readiness provider move and shim removal
3. setup extraction
4. automation task registry polish and docs/wiki updates
5. review fixes

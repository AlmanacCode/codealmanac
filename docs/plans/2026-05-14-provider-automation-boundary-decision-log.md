# Provider and Automation Boundary Refactor Decision Log

Branch: `codex/provider-automation-boundary-refactor`

Plan: `docs/plans/2026-05-14-provider-automation-boundary-refactor.md`

## Decisions

### Use a global worktree location

The main checkout on `dev` had unrelated `.almanac/pages/` changes and the newly drafted plan was untracked. No project-local `.worktrees/` or `worktrees/` directory existed, and `.worktrees/` was not ignored. To avoid changing `.gitignore` or mixing unrelated local wiki edits into this branch, the implementation uses `/Users/rohan/.config/superpowers/worktrees/codealmanac/provider-automation-boundary-refactor`.

### Treat `dist/` as a baseline prerequisite for tests

The repository's tests can depend on `dist/codealmanac.js` being present because automation command-path resolution looks for the packaged CLI entrypoint. In a fresh worktree, `dist/` is absent because it is gitignored, so the first baseline `npm test` failed in `test/setup.test.ts`. Running `npm run build` before the suite restored the expected baseline.

### Preserve behavior while moving boundaries

The refactor will keep public command names, launchd plist paths, default intervals, ledger path/shape, skip reasons, and operation semantics unchanged. Changes should be structural until a task explicitly calls for status output improvement.

### Keep `runAutomationInstall()` as orchestration, not launchd plumbing

Automation install still has to combine command option validation, activation-baseline mutation, two scheduler jobs, and user output. The cleanup moves task definitions, launchd mechanics, and legacy hook cleanup out of the command file, but keeps the single user-facing install transaction in `src/commands/automation.ts` so partial failure messages and setup integration remain easy to follow.

### Treat transcript discovery as capture domain code

Claude and Codex transcript discovery scans historical transcript stores. It maps transcript metadata to wiki repos, but it does not execute agents. That makes it capture-domain code rather than harness provider code. The harness provider layer should stay responsible for executing `AgentRunSpec` values, while `src/capture/discovery/` owns the scanner adapters.

### Keep compatibility re-exports for renamed config and readiness modules

The architectural home for global config is now `src/config/`, and the architectural home for setup/doctor provider projection is now `src/agent/readiness/`. The old `src/update/config.ts` and `src/agent/provider-view.ts` paths remain as one-line re-exports because tests and any external deep imports can migrate separately. Production code now imports the new homes.

### Remove the old execution half of `src/agent/providers`

Current AI operation execution already goes through `src/harness/providers/` via the process manager. The `run()` methods in `src/agent/providers/*` were a second execution-provider layer and were no longer called. Removing those methods leaves the remaining layer responsible for setup/status/model readiness only, which makes the distinction from harness providers concrete rather than purely nominal.

### Status should distinguish file installation from scheduler load state

`almanac automation status` now treats plist existence and launchd load state as separate facts. The command remains non-fatal when launchd says a job is not loaded; it reports `launchd loaded: no` so scheduler registration problems are distinguishable from missing plist files.

### Sweep orchestration belongs in capture, not commands

The CLI wrapper still chooses apps, quiet duration, config path, and output format, but the sweep pipeline is capture-domain behavior. `src/capture/sweep.ts` now owns eligibility decisions, lock acquisition, ledger reconciliation, cursor context, capture-start result handling, and summary construction. The command passes a `startCapture` callback so capture-domain orchestration does not import the command implementation directly.

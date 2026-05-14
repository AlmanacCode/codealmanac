# Provider and Automation Boundary Refactor Implementation Log

Branch: `codex/provider-automation-boundary-refactor`

Plan: `docs/plans/2026-05-14-provider-automation-boundary-refactor.md`

## 2026-05-14

### Baseline

- Created isolated global worktree at `/Users/rohan/.config/superpowers/worktrees/codealmanac/provider-automation-boundary-refactor`.
- Created branch `codex/provider-automation-boundary-refactor` from `dev`.
- Copied the accepted design plan into the worktree.
- Installed dependencies with `npm install`.
- Noted npm engine warning: current shell uses Node `v21.7.3`, while `package.json` supports `20.x || 22.x || 23.x || 24.x || 25.x`.
- Initial `npm test` failed because gitignored `dist/` was absent, causing automation tests to resolve Vitest's process entrypoint instead of `dist/codealmanac.js`.
- Ran `npm run build`, then reran `npm test`.
- Baseline after build: `54` test files passed, `465` tests passed.

### Automation Boundary Extraction

- Added `src/automation/tasks.ts` for scheduler task labels, defaults, plist paths, and default CLI program arguments.
- Added `src/automation/launchd.ts` for launchd plist rendering, directory setup, PATH construction, bootstrap, removal, and plist status parsing.
- Added `src/automation/legacy-hooks.ts` for private cleanup of historical Claude/Codex/Cursor hook installs.
- Rewrote `src/commands/automation.ts` as the command-facing orchestrator. It still validates options, records the automation activation baseline, formats command output, and preserves the existing public exports used by setup/uninstall.
- Verified focused behavior with `npm test -- --run test/automation.test.ts`: `5` tests passed.
- Verified TypeScript/package build with `npm run build`: succeeded.

### Capture Sweep Boundary Extraction

- Added `src/capture/discovery/` with provider-specific Claude and Codex transcript discovery plus shared JSONL metadata helpers.
- Kept transcript discovery outside `src/harness/providers/`; harness providers remain execution adapters, while discovery scans historical transcript stores.
- Added `src/capture/ledger.ts` for repo-local capture ledger loading, atomic writes, pending-run reconciliation, cursor math, line counting, and prefix hashes.
- Added `src/capture/lock.ts` for repo-level sweep lock creation, stale-lock recovery, and release.
- Reduced `src/commands/capture-sweep.ts` to command parsing, eligibility orchestration, capture enqueueing, summary construction, and command output rendering.
- Verified focused behavior with `npm test -- --run test/capture-sweep.test.ts`: `7` tests passed.
- Verified TypeScript/package build with `npm run build`: succeeded.

### Provider Readiness and Config Boundary Cleanup

- Moved the global config implementation from `src/update/config.ts` to `src/config/index.ts`.
- Left `src/update/config.ts` as a compatibility re-export so existing tests and external import paths keep working while production code uses `src/config/`.
- Moved the provider setup/status projection from `src/agent/provider-view.ts` to `src/agent/readiness/view.ts` and left the old path as a compatibility re-export.
- Updated production imports for `agents`, `setup`, `doctor`, operation commands, automation, capture sweep, and update commands to use `src/config/` and `src/agent/readiness/`.
- Removed unused legacy agent execution methods from the setup/status provider layer. Runtime execution remains in `src/harness/providers/`.
- Deleted the unused old JSONL execution helpers under `src/agent/providers/`.
- Verified affected behavior with `npm test -- --run test/provider-view.test.ts test/config-command.test.ts test/setup.test.ts test/doctor.test.ts`: `33` tests passed.
- Verified TypeScript/package build with `npm run build`: succeeded.

### Automation Status Load-State Check

- Extended launchd status helpers to check `launchctl print gui/<uid>/<label>`.
- Updated `almanac automation status` output to report `launchd loaded: yes|no` separately from plist existence.
- Added a focused automation test that injects loaded capture automation and unloaded Garden automation.
- Verified focused behavior with `npm test -- --run test/automation.test.ts`: `6` tests passed.
- Verified TypeScript/package build with `npm run build`: succeeded.

### Wiki Updates

- Updated `.almanac/pages/automation.md` to document the new `src/automation/` split and the separate launchd loaded-state status check.
- Updated `.almanac/pages/capture-flow.md` to document `src/capture/discovery/`, `src/capture/ledger.ts`, and `src/capture/lock.ts`.
- Updated `.almanac/pages/harness-providers.md` to state that runtime execution belongs in `src/harness/providers/`, while `src/agent/readiness/view.ts` and the remaining `src/agent/providers/` code are setup/status/model readiness only.

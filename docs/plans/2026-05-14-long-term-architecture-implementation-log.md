# Long-Term Architecture Cleanup Implementation Log

Branch: `codex/long-term-arch-cleanup`

Plan: `docs/plans/2026-05-14-long-term-architecture-cleanup.md`

## 2026-05-14

### Baseline

- Created isolated worktree at `/Users/rohan/.config/superpowers/worktrees/codealmanac/long-term-arch-cleanup`.
- Created branch `codex/long-term-arch-cleanup` from `origin/dev` at `a5da4cb`.
- Installed dependencies with `npm install`.
- Noted npm engine warnings: the shell uses Node `v21.7.3`, while package engines allow `20.x || 22.x || 23.x || 24.x || 25.x`.
- Almanac searches for broad architecture queries returned no exact page; relevant active pages were `lifecycle-cli`, `global-agent-instructions`, and `harness-providers`.
- Ran `npm run build`: succeeded.

### Provider Readiness Move

- Moved setup/status/model readiness provider code from `src/agent/providers/` to `src/agent/readiness/providers/`.
- Updated production imports in setup, doctor, install-targets, and the Claude harness auth import.
- Updated tests to import `src/agent/readiness/view.ts`, `src/agent/readiness/providers/claude/index.ts`, and `src/config/index.ts`.
- Deleted internal compatibility shims `src/agent/provider-view.ts`, `src/agent/providers.ts`, and `src/update/config.ts`.
- Fixed update notifier modules to import config from `src/config/index.ts`.
- Verified with `npm run build`: succeeded.
- Verified with `npm test -- --run test/provider-view.test.ts test/agents-command.test.ts test/setup.test.ts test/doctor.test.ts test/auth.test.ts test/config-command.test.ts test/update.test.ts test/update-announce.test.ts`: `72` tests passed.

### Setup Command Split

- Extracted setup terminal rendering, prompts, and select-list input handling into `src/commands/setup/output.ts`.
- Extracted bundled guide path resolution and legacy `IMPORT_LINE` exports into `src/commands/setup/guides.ts`.
- Extracted setup provider/model selection into `src/commands/setup/agent-choice.ts`, keeping provider readiness as a projection over config plus readiness providers.
- Left `src/commands/setup.ts` as the top-level setup workflow so install path, automation, guides, and auto-commit steps remain readable in execution order.
- Verified with `npm run build`: succeeded.
- Verified with `npm test -- --run test/setup.test.ts test/doctor.test.ts test/agents-command.test.ts test/provider-view.test.ts`: `26` tests passed.

### Wiki Reference Cleanup

- Updated active wiki pages that still taught stale internal paths after the provider readiness move.
- Replaced `src/agent/providers/` references in active pages with `src/agent/readiness/providers/`.
- Replaced `src/update/config.ts` file references in active automation pages with `src/config/index.ts`.
- Left historical plans and research notes untouched when their old paths are part of dated implementation history.
- Verified with `almanac health --topic agents`: all categories ok.
- Verified with `almanac health --topic automation`: all categories ok.

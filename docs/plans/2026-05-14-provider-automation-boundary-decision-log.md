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


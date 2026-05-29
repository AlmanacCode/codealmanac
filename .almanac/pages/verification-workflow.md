---
title: Verification Workflow
summary: CodeAlmanac verification requires build, TypeScript typecheck, and Vitest because `npm test` does not run `tsc --noEmit`.
topics: [automation, flows]
sources:
  - id: package-scripts
    type: file
    path: package.json
    note: Defines `npm test` as Vitest and `npm run lint` as TypeScript typecheck.
  - id: ci-workflow
    type: file
    path: .github/workflows/ci.yml
    note: Runs build, typecheck, and tests on push and pull request for Node 20 and Node 22.
  - id: pr-template
    type: file
    path: .github/PULL_REQUEST_TEMPLATE.md
    note: Prompts contributors to report build, typecheck, and test commands in PR verification notes.
  - id: source-provenance-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T12-14-55-019e6f94-fae1-7780-b2c9-3e2f3d6b6f3e.jsonl
    note: Records the CI failure where Vitest passed locally but `tsc --noEmit` failed on the source-provenance and review changes.
  - id: typecheck-fix-commit
    type: commit
    rev: 3b6d7fc
    note: Fixes strict TypeScript errors in review lookup narrowing, source normalization, and review summary parsing after CI caught them.
status: active
---

# Verification Workflow

CodeAlmanac's local verification loop needs three separate checks: `npm run build`, `npm run lint`, and `npm test`. `npm test` runs `vitest run`; it does not run TypeScript typechecking. `npm run lint` is the project script for `tsc --noEmit`, despite the name. [@package-scripts]

The GitHub Actions CI workflow runs on every push and pull request. It installs dependencies with `npm ci`, runs `npm run build`, runs `npx tsc --noEmit`, and then runs `npm test` on Node 20 and Node 22. A local green Vitest run is therefore not equivalent to a green CI run. [@ci-workflow]

The 2026-05-28 [[source-provenance]] implementation exposed this gap. The full Vitest suite passed locally, but CI failed on TypeScript errors in review lookup narrowing, normalized source construction, and review summary parsing. Commit `3b6d7fc` fixed those errors by using an explicit union guard, removing an unsafe generic cast from source normalization, and handling a possibly missing regex capture group. [@source-provenance-session] [@typecheck-fix-commit]

The pull request template already asks contributors to report build, typecheck, and test commands. Future implementation sessions should treat that as the minimum verification set before pushing TypeScript changes, especially changes touching shared model types, parser normalization, command return unions, or indexed projections. [@pr-template]

## Related Pages

[[source-provenance]] records the source metadata feature whose CI failure produced this workflow lesson. [[capture-automation]] records another implementation session that verified with lint, tests, and build.

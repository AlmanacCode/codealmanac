# Structured Output Protocol

## Scope

Implement the named follow-up slice from
`2026-05-07-agent-first-cli-surface.md`: add a shared `CommandOutcome` protocol
with the four shapes `success`, `noop`, `needs-action`, and `error`, then use it
for the agent lifecycle commands where fixable failures matter most.

## Decisions

- Keep the existing `{ stdout, stderr, exitCode }` command return contract.
  `CommandOutcome` is rendered into that contract so existing commands do not
  need a repo-wide rewrite.
- Add `--json` to `bootstrap` and `capture` for structured `CommandOutcome`
  output.
- Suppress streaming output when `--json` is active so stdout remains parseable.
- Keep human behavior compatible: fixable failures still go to stderr with the
  `almanac:` prefix and a one-line fix hint.

## Implemented

- `src/cli/outcome.ts`
- `bootstrap --json`
- `capture --json`
- `needs-action` outcomes for auth, populated wiki, and missing wiki cases
- `noop` outcome for capture runs where no pages changed
- focused tests for outcome rendering and lifecycle command JSON

## Out Of Scope

- Migrating every query command to `CommandOutcome`
- Changing exit-code policy globally
- Removing compatibility aliases or reshaping command groups

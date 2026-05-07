# 2026-05-07 Command Deprecations

## Scope

This slice keeps shipped compatibility surfaces working while making the
preferred CLI shape obvious in help, docs, diagnostics, and warnings.

Deprecated compatibility surfaces:

- `almanac set default-agent <provider>`
- `almanac set model <provider> <model>`
- `almanac ps`
- `almanac show <slug> --raw`
- `almanac update --enable-notifier`
- `almanac update --disable-notifier`

Canonical replacements:

- `almanac agents use <provider>`
- `almanac agents model <provider> <model>`
- `almanac capture status`
- `almanac show <slug> --body`
- `almanac config set update_notifier true`
- `almanac config set update_notifier false`

## Design

Do not remove commands in this slice. The project has README examples and
released behavior, so removal is more expensive than a compatibility warning.
Instead:

- legacy surfaces print a single stderr deprecation warning
- canonical surfaces do not warn
- root help keeps compatibility commands visible under `Deprecated`, not mixed
  into normal command groups
- docs use canonical commands for examples and explain compatibility where it
  matters

The provider command implementation should use neutral internal helpers, then
wrap the old `set` exports with deprecation warnings. This prevents canonical
`agents` behavior from being conceptually implemented as legacy `set`.

## Files

- `src/commands/agents.ts`
- `src/commands/update.ts`
- `src/commands/doctor-checks/updates.ts`
- `src/cli/register-setup-commands.ts`
- `src/cli/register-query-commands.ts`
- `src/cli/register-wiki-lifecycle-commands.ts`
- `src/cli/help.ts`
- `README.md`
- `guides/mini.md`
- `guides/reference.md`
- focused tests for warnings and canonical replacements

## Verification

- unit tests for legacy warning behavior
- unit tests proving canonical replacements do not warn
- config tests for `update_notifier`
- doctor tests for the new canonical fix command
- full `npm test`, lint, and build before commit

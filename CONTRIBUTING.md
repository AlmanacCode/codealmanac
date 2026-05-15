# Contributing to Almanac

Thanks for helping improve Almanac. The project is a local-first codebase wiki for AI coding agents, so the contribution bar is not only "does it work?" but also "will a future agent understand why this shape exists?"

## Start Here

```bash
git clone https://github.com/AlmanacCode/codealmanac.git
cd codealmanac
npm install
npm run build
npm test
```

For local CLI testing:

```bash
npm link
almanac --help
```

## Development Checks

Run these before opening a pull request:

```bash
npm run build
npx tsc --noEmit
npm test
```

Use focused Vitest runs while developing, then run the full suite before review.

## Working With The Codebase

- Read `README.md` and `docs/concepts.md` for the user-facing model.
- Read `AGENTS.md` before structural changes. It contains the active implementation philosophy and non-negotiables.
- Search the local `.almanac/` wiki before changing a subsystem. The wiki captures decisions, invariants, and gotchas that are not obvious from code.
- Keep changes local-first. Almanac stores repo wiki data in `.almanac/` and global registry data in `~/.almanac/`.
- Keep commands scriptable. Avoid interactive prompts in CLI flows.

## Tests And Fixtures

Tests use Vitest. Any test that touches `~/.almanac/` or creates a wiki must wrap its body in `withTempHome` from `test/helpers.ts`; this prevents tests from touching a real user registry.

Prefer the existing helpers in `test/helpers.ts`:

- `withTempHome`
- `makeRepo`
- `scaffoldWiki`
- `writePage`

## Pull Request Shape

A good pull request includes:

- A clear problem statement.
- The design choice, including rejected alternatives when architecture changes.
- Tests or a short explanation of why no automated test is useful.
- Any docs or `.almanac/` wiki updates needed for future agents.

Keep pull requests buildable and scoped. Avoid unrelated formatting churn.

## Commit Conventions

Use the existing commit style:

- `feat(slice-N): <summary>` for new slice work.
- `fix(slice-N-review): <summary>` for review fixes.
- `docs: <summary>` for documentation-only changes.
- `refactor(slice-N): <summary>` for structural cleanup within a slice.

## Good First Contributions

Good first issues usually improve docs, examples, error messages, or focused command behavior. If you are unsure where to start, look for issues labeled `good first issue` or open a short issue describing what you want to improve.

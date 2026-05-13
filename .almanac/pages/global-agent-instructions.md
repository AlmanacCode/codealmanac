---
title: Global Agent Instructions
summary: "`almanac setup` installs global Claude and Codex instruction artifacts differently: Claude reads copied guide files plus a `CLAUDE.md` import, while Codex reads an inline managed block in the active global AGENTS file."
topics: [agents, cli, flows]
files:
  - src/commands/setup.ts
  - src/commands/uninstall.ts
  - src/commands/doctor-checks/install.ts
  - src/agent/providers/codex-instructions.ts
  - test/setup.test.ts
  - test/uninstall.test.ts
  - test/doctor.test.ts
sources:
  - docs/plans/2026-05-11-almanac-naming-migration.md
  - /Users/kushagrachitkara/.codex/sessions/2026/05/12/rollout-2026-05-12T14-29-09-019e1e17-fe55-7362-b42e-bb000f81f93e.jsonl
  - /Users/kushagrachitkara/.codex/sessions/2026/05/12/rollout-2026-05-12T20-25-14-019e1f5d-ff59-7ee1-a73b-836277d8092b.jsonl
status: active
verified: 2026-05-12
---

# Global Agent Instructions

`almanac setup` has one "install agent instructions" step, but it writes different artifacts for Claude and Codex because the two harnesses read global guidance differently. Claude gets copied markdown files under `~/.claude/` plus an import line in `~/.claude/CLAUDE.md`. Codex gets the same mini-guide content written inline into the active global AGENTS file under `~/.codex/`.

## Claude install contract

[[src/commands/setup.ts]] copies two bundled guide files into `~/.claude/`:

- `almanac.md` from `guides/mini.md`
- `almanac-reference.md` from `guides/reference.md`

It then appends the exact import token `@~/.claude/almanac.md` to `~/.claude/CLAUDE.md` if that token is not already present on a trimmed line. `hasImportLine()` treats annotated variants such as `@~/.claude/almanac.md # note` as already installed, but rejects longer accidental prefixes such as `@~/.claude/almanac.md-extra`.

The guide-file copy path is byte-sensitive. If the bundled file contents already match the destination file, setup skips the write so rerunning setup does not bump guide mtimes for no reason.

## Codex install contract

[[src/agent/providers/codex-instructions.ts]] implements the setup-specific rule for which file Almanac should edit: `resolveCodexAgentsPath()` uses `~/.codex/AGENTS.override.md` only when that file exists and `trim()` is non-empty; otherwise it falls back to `~/.codex/AGENTS.md`.

The managed Almanac block is delimited by `<!-- almanac:start -->` and `<!-- almanac:end -->`. Setup writes the Claude mini-guide content inline between those markers because Codex treats `@file` references inside AGENTS files as plain text instead of expanding them.

If both managed markers already exist, setup replaces only the block body. If not, it appends a new managed block with a blank-line separator when needed. Unrelated user-authored AGENTS content before or after the managed block stays untouched.

## Uninstall and migration cleanup

[[src/commands/uninstall.ts]] removes exactly the instruction artifacts setup owns:

- the `@~/.claude/almanac.md` import line from `CLAUDE.md`
- the guide files `almanac.md` and `almanac-reference.md`
- the managed Almanac block from both `AGENTS.md` and `AGENTS.override.md`

Uninstall also cleans up the pre-rename Claude and Codex artifacts from the older `codealmanac` naming era. It removes `@~/.claude/codealmanac.md`, deletes legacy `codealmanac*.md` guide files, and strips legacy `<!-- codealmanac:start --> ... <!-- codealmanac:end -->` Codex blocks if they are still present.

If cleanup removes the only remaining content from `CLAUDE.md`, `AGENTS.md`, or `AGENTS.override.md`, uninstall deletes that file instead of leaving an empty fingerprint behind.

## No single clean-slate command

The repo does not currently implement a one-shot "clean slate" command for Almanac artifacts. The 2026-05-11 naming-migration plan records a future slash-command recipe for that job, but the current tree still has no `.claude/commands/clean-slate.md`, no dedicated CLI command under [[src/commands/]], and no CLI registration for such a command.

That distinction matters because [[src/commands/uninstall.ts]] only removes the artifacts setup owns plus scheduler and legacy-hook state. A full machine-level reset still requires manual cleanup outside the current command surface, including the global npm package, `~/.almanac`, and stale `~/.npm/_npx/.../node_modules/codealmanac` caches described in `docs/plans/2026-05-11-almanac-naming-migration.md`.

## Verification boundary

The 2026-05-12 install-verification session confirmed the current fresh-install footprint on disk:

- `~/.claude/almanac.md`
- `~/.claude/almanac-reference.md`
- `~/.claude/CLAUDE.md` containing `@~/.claude/almanac.md`
- `~/.codex/AGENTS.md` containing the managed `<!-- almanac:start -->` block when no non-empty `AGENTS.override.md` exists

[[src/commands/doctor-checks/install.ts]] currently verifies only the Claude-side artifacts through `install.guides` and `install.import`. There is no Codex-specific doctor check yet, so debugging "Codex is not seeing Almanac guidance" still requires reading `~/.codex/AGENTS.override.md` and `~/.codex/AGENTS.md` directly and checking which file is active.

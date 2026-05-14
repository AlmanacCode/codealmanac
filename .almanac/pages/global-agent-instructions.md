---
title: Global Agent Instructions
summary: "`almanac setup` installs global Claude and Codex instruction artifacts differently: Claude reads copied guide files plus a `CLAUDE.md` import, while Codex reads an inline managed block in the active global AGENTS file."
topics: [agents, cli, flows]
files:
  - src/commands/setup.ts
  - src/commands/setup/guides.ts
  - src/commands/uninstall.ts
  - src/commands/doctor-checks/install.ts
  - src/agent/readiness/providers/codex-instructions.ts
  - test/setup.test.ts
  - test/uninstall.test.ts
  - test/doctor.test.ts
sources:
  - docs/plans/2026-05-11-almanac-naming-migration.md
  - /Users/kushagrachitkara/.codex/sessions/2026/05/12/rollout-2026-05-12T14-29-09-019e1e17-fe55-7362-b42e-bb000f81f93e.jsonl
  - /Users/kushagrachitkara/.codex/sessions/2026/05/12/rollout-2026-05-12T20-25-14-019e1f5d-ff59-7ee1-a73b-836277d8092b.jsonl
  - /Users/kushagrachitkara/.codex/sessions/2026/05/13/rollout-2026-05-13T13-34-26-019e230c-4437-7422-9e8d-b7caa9b592fc.jsonl
status: active
verified: 2026-05-13
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

[[src/agent/readiness/providers/codex-instructions.ts]] implements the setup-specific rule for which file Almanac should edit: `resolveCodexAgentsPath()` uses `~/.codex/AGENTS.override.md` only when that file exists and `trim()` is non-empty; otherwise it falls back to `~/.codex/AGENTS.md`.

The managed Almanac block is delimited by `<!-- almanac:start -->` and `<!-- almanac:end -->`. Setup writes the Claude mini-guide content inline between those markers because Codex treats `@file` references inside AGENTS files as plain text instead of expanding them.

If both managed markers already exist, setup replaces only the block body. If not, it appends a new managed block with a blank-line separator when needed. Unrelated user-authored AGENTS content before or after the managed block stays untouched.

## Uninstall and migration cleanup

[[src/commands/uninstall.ts]] removes exactly the instruction artifacts setup owns:

- the `@~/.claude/almanac.md` import line from `CLAUDE.md`
- the guide files `almanac.md` and `almanac-reference.md`
- the managed Almanac block from both `AGENTS.md` and `AGENTS.override.md`

Uninstall also cleans up the pre-rename Claude and Codex artifacts from the older `codealmanac` naming era. It removes `@~/.claude/codealmanac.md`, deletes legacy `codealmanac*.md` guide files, and strips legacy `<!-- codealmanac:start --> ... <!-- codealmanac:end -->` Codex blocks if they are still present.

If cleanup removes the only remaining content from `CLAUDE.md`, `AGENTS.md`, or `AGENTS.override.md`, uninstall deletes that file instead of leaving an empty fingerprint behind.

## Markdown-only reset for reinstall tests

A 2026-05-12 manual reinstall test verified a narrower reset path than full uninstall. For testing only the agent-instruction markdown wiring, it was enough to delete `~/.claude/almanac.md`, `~/.claude/almanac-reference.md`, and the legacy `codealmanac*.md` guide files, then clear `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` to zero bytes.

That state is "as good as new" only for the markdown artifacts. It does not remove other Almanac install state such as the launchd automation plist, hook cleanup state, the global npm package, or `~/.almanac` data. The distinction matters because users may ask whether a fresh `npx codealmanac` run will recreate the guides; the answer is yes for the markdown layer, but no session should describe that partial reset as a full machine-level clean slate.

The same test also confirmed one setup edge condition from code against a real install. When `~/.codex/AGENTS.override.md` is absent and `~/.codex/AGENTS.md` is empty, rerunning setup recreates the managed `<!-- almanac:start --> ... <!-- almanac:end -->` block in `AGENTS.md` rather than requiring the file to be deleted first.

## No single clean-slate command

The repo does not currently implement a one-shot "clean slate" command for Almanac artifacts. The 2026-05-11 naming-migration plan records a future slash-command recipe for that job, but the current tree still has no `.claude/commands/clean-slate.md`, no dedicated CLI command under [[src/commands/]], and no CLI registration for such a command.

That distinction matters because [[src/commands/uninstall.ts]] only removes the artifacts setup owns plus scheduler and legacy-hook state. A full machine-level reset still requires manual cleanup outside the current command surface, including the global npm package, `~/.almanac`, and stale `~/.npm/_npx/.../node_modules/codealmanac` caches described in `docs/plans/2026-05-11-almanac-naming-migration.md`.

## Verification boundary

The 2026-05-12 install-verification session confirmed the current fresh-install footprint on disk:

- `~/.claude/almanac.md`
- `~/.claude/almanac-reference.md`
- `~/.claude/CLAUDE.md` containing `@~/.claude/almanac.md`
- `~/.codex/AGENTS.md` containing the managed `<!-- almanac:start -->` block when no non-empty `AGENTS.override.md` exists

The same session also confirmed the reinstall path from a markdown-only reset: after clearing the markdown artifacts manually, a fresh `npx codealmanac` install recreated the two Claude guide files, restored the `@~/.claude/almanac.md` import, and repopulated `~/.codex/AGENTS.md` with the inline managed block.

[[src/commands/doctor-checks/install.ts]] currently verifies only the Claude-side artifacts through `install.guides` and `install.import`. There is no Codex-specific doctor check yet, so debugging "Codex is not seeing Almanac guidance" still requires reading `~/.codex/AGENTS.override.md` and `~/.codex/AGENTS.md` directly and checking which file is active.

The provider-status path adds one more practical split for Codex debugging. [[src/harness/providers/codex.ts]] treats Codex as installed only when the `codex` executable is visible on `PATH`; otherwise it reports `codex not found on PATH` before any AGENTS-file logic matters. A support triage for "Codex works in one place but Almanac cannot see it" should therefore start with `which codex` and `codex --version`, then move on to which of `~/.codex/AGENTS.override.md` or `~/.codex/AGENTS.md` is active.

---
title: Almanac Doctor
summary: >-
  `almanac doctor` reports install, agent, update, and wiki status, but it currently stops at
  diagnosis and prints `run:` hints instead of applying repairs.
topics:
  - cli
  - systems
sources:
  - id: install-targets
    type: file
    path: src/agent/install-targets.ts
    note: Migrated from legacy files.
  - id: index
    type: file
    path: src/cli/commands/doctor/index.ts
    note: Migrated from legacy files.
  - id: install
    type: file
    path: src/cli/commands/doctor/install.ts
    note: Migrated from legacy files.
  - id: wiki
    type: file
    path: src/services/wiki/doctor.ts
    note: Wiki doctor checks for repo, registry, index, absorb, and health state.
  - id: updates
    type: file
    path: src/cli/commands/doctor/updates.ts
    note: Migrated from legacy files.
  - id: probes
    type: file
    path: src/cli/commands/doctor/probes.ts
    note: Migrated from legacy files.
  - id: index-2
    type: file
    path: src/cli/commands/setup/index.ts
    note: Migrated from legacy files.
  - id: abi-guard
    type: file
    path: src/abi-guard.ts
    note: Migrated from legacy files.
  - id: doctor-test
    type: file
    path: test/doctor.test.ts
    note: Migrated from legacy files.
  - docs/plans/2026-04-30-doctor-refactor.md
  - docs/bugs/codealmanac-known-bugs.md
  - >-
    /Users/kushagrachitkara/.codex/sessions/2026/05/12/rollout-2026-05-12T00-52-10-019e1b2c-0679-7bb0-a926-b8643aa710c1.jsonl
verified: 2026-05-13T00:00:00.000Z
status: active

---

# Almanac Doctor

`almanac doctor` is the install-and-environment diagnostic command. It is separate from `almanac health`: doctor answers "is this install usable on this machine and in this repo," while health answers "is this wiki graph internally consistent."

## Current command shape

[[src/cli/commands/doctor/index.ts]] is the composition root. It gathers four check groups and returns either formatted text or a stable JSON object:

- install checks from [[src/cli/commands/doctor/install.ts]]
- agent readiness checks
- update-notifier checks from [[src/cli/commands/doctor/updates.ts]]
- repo wiki checks from [[src/services/wiki/doctor.ts]]

The 2026-05-30 command-folder refactor kept the entrypoint thin and moved the old `doctor-checks/` modules into `src/cli/commands/doctor/`. The later intentional-architecture rewrite moved wiki-specific doctor checks into `src/services/wiki/doctor.ts`, so `src/cli/commands/doctor/index.ts` composes report sections while the wiki service owns repo detection. `src/services/wiki/doctor-registry.ts`, `src/services/wiki/doctor-index.ts`, `src/services/wiki/doctor-absorb.ts`, and `src/services/wiki/doctor-health.ts` own the registry, index, absorb-log, and health-summary probes.

## What install checks cover

The install section currently reports:

- install-path detection, including whether the current binary is running from an ephemeral `npx`-style location
- `better-sqlite3` native-binding readiness
- Claude authentication state
- whether scheduled capture automation is installed
- whether Claude guide files exist under `~/.claude/`
- whether the global agent instruction entries are installed for Claude and Codex

[[src/cli/commands/doctor/install.ts]] expresses repairs as `fix: "run: ..."` strings. The command prints those hints, but it does not execute them.

The `install.import` JSON key is intentionally stable even though the meaning expanded in the 2026-05-13 provider refactor. It now checks the Claude `CLAUDE.md` import and the Codex managed AGENTS block via [[src/agent/install-targets.ts]], and the human message says "Agent instruction entries" rather than naming only Claude imports.

## Relationship to the SQLite ABI guard

[[install-time-node-launcher]] now reduces the most common mismatch path by pinning published bins to the installing Node executable. [[src/abi-guard.ts]] still fails early when `better-sqlite3` cannot load under the current Node ABI and prints an exact rebuild command. Doctor surfaces the same failure class as structured install state: `install.sqlite` reports whether the binding loads and points users at `npm rebuild better-sqlite3` when it does not.

One 2026-05-13 launchd debugging session added an important scheduler-specific constraint to that repair hint. When scheduled automation is pinned to an absolute Node path in its plist `ProgramArguments`, rebuilding `better-sqlite3` from a different shell Node version can leave launchd broken even though the shell rebuild succeeds. Future agents should compare the failing plist runtime against the active shell runtime and rebuild with the plist's `node` or `npm` path when they differ.

This matters because the SQLite binding is the main query-stack fragility called out in [[sqlite-indexer]] and `docs/bugs/codealmanac-known-bugs.md`. [[install-time-node-launcher]] narrows the failure surface for normal installs, but doctor still explains the remaining cases and the repair is still manual.

## Wiki-scope checks

The wiki section first resolves the nearest repo with `.almanac/`. When one exists, it reports:

- repo root
- whether the repo is already present in the global [[global-registry]]
- indexed page and topic counts when `.almanac/index.db` is readable
- index age
- most recent absorb log age
- an `almanac health` summary

The "last absorb" line currently has a narrow scanner. [[src/services/wiki/doctor-absorb.ts]] checks `.almanac/logs` and `.almanac/` for `.absorb-*` log/jsonl files, but it does not scan `.almanac/jobs/` for the job records described in [[process-manager-runs]]. A 2026-05-13 support check found the same class of mismatch before the jobs storage rename: doctor reported an old last-capture artifact even though the job record, matching JSONL log, and hook log proved background capture had completed minutes earlier. When doctor and jobs disagree, trust the job record and hook log for recent background Absorb jobs.

If wiki checks throw, [[src/cli/commands/doctor/index.ts]] degrades to a single `wiki.checks` problem entry instead of crashing the whole command.

## Verification boundaries

Doctor still does not repair setup artifacts directly, but its instruction check now covers both Claude and Codex global instruction entries. [[global-agent-instructions]] documents the exact artifacts and the managed-block rules.

The command also remains diagnostic-only. Even when a fix is straightforward, such as reinstalling automation or rerunning setup to restore guide files, doctor only prints the suggested command.

A 2026-05-28 source-provenance discussion clarified the future repair boundary. `doctor --fix`, if added, should repair install and environment problems such as SQLite ABI state, setup-owned instruction entries, registry entries, and automation installation. Deterministic wiki-corpus repairs such as legacy `files:` to structured `sources:` migration belong to `almanac health --fix`, because [[source-provenance|source provenance]] is wiki content health rather than install health.

## Product direction recorded on 2026-05-12

The captured Codex session on 2026-05-12 proposed `almanac doctor --fix` as a follow-on feature after the repo itself hit a real `better-sqlite3` ABI mismatch during exploration. The proposal was to auto-repair only safe local problems that doctor already knows how to diagnose:

- rebuild `better-sqlite3` for the active Node runtime
- recreate a missing `.almanac/index.db`
- rerun setup-owned guide installation
- repair or refresh the global registry
- reinstall scheduled automation when configuration says it should exist

The same discussion kept one boundary explicit: destructive or ambiguous cases should stay manual and continue to surface as warnings rather than silent mutations.

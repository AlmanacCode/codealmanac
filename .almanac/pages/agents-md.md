---
title: AGENTS.md
summary: Codex loads durable instructions from global and project `AGENTS.md` files, and CodeAlmanac setup writes its managed Codex guide inline into the active global file because Codex does not expand `@file` references there.
topics: [agents, stack]
files:
  - src/agent/providers/codex-instructions.ts
  - src/commands/setup.ts
  - src/commands/uninstall.ts
sources:
  - https://developers.openai.com/codex/guides/agents-md
  - docs/research/2026-05-09-codex-harness-capabilities.md
  - /Users/kushagrachitkara/.codex/sessions/2026/05/12/rollout-2026-05-12T14-39-37-019e1e21-939f-79f1-9722-c890eb4d1f38.jsonl
status: active
verified: 2026-05-12
---

# AGENTS.md

`AGENTS.md` is Codex's durable instruction file. In this project it matters in two distinct ways: human Codex sessions read it directly, and CodeAlmanac setup manages a small Codex-specific Almanac guide inside the active global file under `~/.codex/`.

## Codex loading rules

The official Codex guide says Codex reads instruction files before doing work. Global scope is `~/.codex/AGENTS.override.md` when that file exists and is non-empty; otherwise Codex uses `~/.codex/AGENTS.md`. Project scope then walks from the project root down to the current working directory and concatenates matching `AGENTS.md` files from broad to specific. Later, more specific files therefore override earlier guidance by position in the combined prompt.

The same guide says empty files are skipped. It also documents a default combined size limit controlled by `project_doc_max_bytes`, with a default of `32 KiB`.

## CodeAlmanac's managed block

[[src/agent/providers/codex-instructions.ts]] encodes the repo's assumption about the active global file. `resolveCodexAgentsPath()` prefers `AGENTS.override.md` only when it exists and `trim()` is non-empty; otherwise it falls back to `AGENTS.md`. That matches the official Codex discovery rule instead of blindly preferring the override filename.

The same file preserves one Codex-specific constraint in code comments and behavior: Codex treats `@file` references inside `AGENTS.md` as plain text rather than expanding them like Claude does in `CLAUDE.md`. `ensureCodexInstructions()` therefore writes the Almanac mini guide inline between `<!-- almanac:start -->` and `<!-- almanac:end -->` instead of trying to import `~/.claude/almanac.md` or another shared file.

## Setup and uninstall behavior

[[src/commands/setup.ts]] installs Claude and Codex guidance differently on purpose. Claude gets copied guide files plus an `@~/.claude/almanac.md` import line in `CLAUDE.md`. Codex gets the same mini-guide content inserted directly into the active global AGENTS file. Setup is idempotent because it replaces or appends only the managed block and leaves unrelated user text intact.

[[src/commands/uninstall.ts]] removes the managed block from both `AGENTS.md` and `AGENTS.override.md` so cleanup does not depend on which file was active when setup last ran. If removing the block leaves either file empty, uninstall deletes that file.

## Role relative to the wiki

[[operation-prompts]] and the wiki are descriptive project memory. `AGENTS.md` is prescriptive agent guidance. The research notes in `docs/research/2026-05-09-codex-harness-capabilities.md` already framed that split: stable repo conventions belong in Codex instruction files, while Build/Absorb/Garden assemble their own operation prompts and should not use `AGENTS.md` as the carrier for transcript-specific or per-run goals.

---
title: Instruction Installation
topics: [architecture, setup]
sources:
  - id: guide-reader
    type: file
    path: src/codealmanac/integrations/setup/guide.py
    note: Reads the packaged agent guide via importlib.resources.
  - id: guide-content
    type: file
    path: src/codealmanac/services/setup/agent-guide.md
    note: Packaged guide text installed into a target coding agent's global instructions.
  - id: instructions
    type: file
    path: src/codealmanac/integrations/setup/instructions.py
    note: FileInstructionInstaller install/uninstall dispatch by SetupTarget.
  - id: claude-installer
    type: file
    path: src/codealmanac/integrations/setup/claude.py
    note: Claude installation mechanics (separate guide file plus import line).
  - id: codex-installer
    type: file
    path: src/codealmanac/integrations/setup/codex.py
    note: Codex installation mechanics (managed block inside AGENTS.md).
  - id: managed-blocks
    type: file
    path: src/codealmanac/integrations/setup/managed_blocks.py
    note: Marker-delimited block upsert and removal helpers.
  - id: setup-models
    type: file
    path: src/codealmanac/services/setup/models.py
    note: SetupTarget enum and InstructionChange result model.
  - id: setup-service
    type: file
    path: src/codealmanac/services/setup/service.py
    note: Setup and uninstall orchestration that calls the instruction installer.
  - id: command-surface
    type: file
    path: almanac/reference/cli/public-command-surface.md
    note: search and show command flags referenced by the installed guide.
---

# Instruction Installation

Instruction installation is how `setup` gives a coding agent (Claude or Codex)
standing knowledge that CodeAlmanac exists and how to use it, before that
agent ever opens a specific repository. `SetupService.run` calls
`FileInstructionInstaller.install` for the selected `SetupTarget` values
unless instructions are skipped [@setup-service] [@instructions]. This is
separate from the per-repository wiki under `almanac/`: instruction
installation writes to the user's home directory, not to any repository.

## The Installed Guide

Both targets install the same guide text. `read_agent_guide` loads
`src/codealmanac/services/setup/agent-guide.md` as packaged data through
`importlib.resources`, so the guide ships with the installed CLI rather than
depending on a source checkout layout [@guide-reader] [@guide-content]. The
guide has two halves that correspond to a coding agent's two different modes
of contact with CodeAlmanac.

The first half orients the agent to the wiki as an ordinary knowledge source
during coding work: when to consult CodeAlmanac (unfamiliar subsystems,
architectural decisions, cross-cutting behavior) versus when it is
unnecessary (typos, mechanical edits), how the `almanac/` tree, page identity,
and `topics.yaml` fit together, then concrete `codealmanac search` (text,
`--mentions`, `--topic`) and `codealmanac show PAGE` (`--lead`, `--body`,
`--links`, `--backlinks`, `--files`, `--topics`) usage matching the public CLI
surface [@guide-content] [@command-surface]. It also tells the agent that code
is authoritative over the wiki for current runtime behavior, and to report a
contradiction rather than propagate it into new code.

The second half is a boundary statement: during ordinary coding work the
agent should treat the wiki as read-only, searching and reading it but not
editing pages, sources, links, topics, or structure. Wiki maintenance belongs
to CodeAlmanac's own Init, Ingest, Garden, and Sync workflows, which carry
their own manuals for deciding what deserves documentation [@guide-content].
This keeps a general-purpose coding agent from improvising wiki edits outside
the lifecycle operations described in [Lifecycle workflows](../lifecycle/workflows)
and [Agents and manuals](../runtime-resources/prompts-and-manuals), which
package stable Yoke agent instructions and expose the manuals those operations use.

## Per-Target Mechanics

Claude and Codex are installed differently because their global instruction
files have different conventions.

For Claude, the installer writes the guide verbatim to a dedicated file,
`~/.claude/codealmanac.md`, and ensures `~/.claude/CLAUDE.md` contains a
single import line, `@~/.claude/codealmanac.md` [@claude-installer]. Uninstall
deletes the guide file and strips the import line, collapsing any blank lines
left behind; if `CLAUDE.md` becomes empty it is removed entirely
[@claude-installer].

For Codex, the installer upserts the guide directly into the agent's AGENTS
file, wrapped in `<!-- codealmanac:start -->` / `<!-- codealmanac:end -->`
markers so a re-run replaces exactly that block instead of duplicating it or
disturbing surrounding content [@codex-installer] [@managed-blocks]. The
target file is `~/.codex/AGENTS.override.md` when that file already has
non-empty content, otherwise `~/.codex/AGENTS.md` [@codex-installer].
Uninstall removes the managed block from both possible paths and deletes a
file that becomes empty [@codex-installer].

Both installers report an `InstructionChange` naming the `SetupTarget`,
whether anything changed, which paths were touched, and a human-readable
message, so `setup`'s JSON and interactive output can say "already installed"
without rewriting untouched files [@setup-models] [@claude-installer]
[@codex-installer]. This mirrors the idempotence expectations described in
[Setup automation and update](automation-and-update).

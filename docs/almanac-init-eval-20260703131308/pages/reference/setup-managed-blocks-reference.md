---
title: Setup Managed Blocks Reference
topics: [reference, setup]
sources:
  - id: blocks
    type: file
    path: src/codealmanac/integrations/setup/managed_blocks.py
  - id: codex
    type: file
    path: src/codealmanac/integrations/setup/codex.py
  - id: claude
    type: file
    path: src/codealmanac/integrations/setup/claude.py
  - id: guide
    type: file
    path: src/codealmanac/services/setup/agent-guide.md
---

# Setup Managed Blocks Reference

This page defines setup-owned instruction file behavior. [[setup-instruction-installers]] explains setup orchestration.

## Managed Block

Managed instruction text is wrapped in CodeAlmanac start/end markers by `format_managed_block()`. Upsert replaces an existing block or appends a new block; removal deletes the managed block and collapses excess blank lines [@blocks].

## Targets

Codex setup writes the managed block to the resolved AGENTS path under `~/.codex` or the home-level AGENTS file [@codex]. Claude setup writes a CodeAlmanac guide file and adds/removes an import line from Claude instructions [@claude].

The guide content comes from `src/codealmanac/services/setup/agent-guide.md` [@guide].

---
page_id: decision-git-mutation-safety
title: Git Mutation Safety
summary: Lifecycle writes are allowed only when preflight and post-run checks show changes stayed under the configured Almanac root.
topics: [decisions, lifecycle]
sources:
  - id: lifecycle-mutation
    type: file
    path: src/codealmanac/workflows/lifecycle_mutation.py
  - id: git-probe
    type: file
    path: src/codealmanac/integrations/workspaces/git/probe.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Git Mutation Safety

Lifecycle writes use Git-backed mutation safety. The mutation policy snapshots workspace state before a harness runs, requires a clean Almanac root preflight, validates reported changed files, compares path diffs afterward, and rejects changes outside the configured root. [@lifecycle-mutation] [@git-probe]

## Status

Accepted. [@live-agreement]

## Context

Harness-backed operations can edit files. The product contract says write-capable lifecycle operations should only mutate wiki pages under the configured Almanac root. [@live-agreement]

## Decision

We will validate the mutation boundary before and after harness execution instead of trusting the harness alone. [@lifecycle-mutation]

## Consequences

A failed harness can still leave recorded output before a later safety failure. This makes debugging possible while preserving the root boundary. [@live-agreement]

This decision constrains `[[architecture-page-run-workflow]]` and is one of the first checks in `[[guide-debug-failed-run]]` when a lifecycle run reports unsafe file changes.

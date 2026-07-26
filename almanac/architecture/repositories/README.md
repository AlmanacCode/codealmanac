---
title: Repository Architecture
topics: [architecture, repositories, local-state, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entries for repositories, local state, persistence, and wiki roots.
  - id: selection-root
    type: wiki
    path: architecture/repositories/selection-and-root
    note: Architecture page for exact repository selection and the fixed almanac root.
  - id: local-state
    type: wiki
    path: architecture/repositories/local-state
    note: Architecture page for repository runtime state outside the committed wiki tree.
  - id: affiliation
    type: wiki
    path: decisions/repository-affiliation-belongs-in-repository-service
    note: Decision page for future temporary checkout and worktree affiliation support.
  - id: local-state-layout
    type: wiki
    path: reference/local-state-layout
    note: Reference page for committed wiki paths and runtime files under ~/.codealmanac/.
  - id: only-root
    type: wiki
    path: decisions/only-almanac-root
    note: Decision page for the fixed almanac/ repo wiki root.
---

# Repository Architecture

Repository architecture is how CodeAlmanac chooses one repo-owned wiki and keeps
that wiki separate from local runtime state. The topic graph groups repository
selection and local state under architecture, while the fixed `almanac/` root is
also constrained by product decisions [@topics] [@only-root].

Read this hub when changing repository registration, current-directory
selection, root validation, runtime paths, local database records, or future
worktree affiliation.

## Reading Order

Start with [Repository selection and root](selection-and-root). It explains the
fixed `almanac/` root, initialized repository markers, exact current-directory
selection, named selection, and why alternate roots are retired
[@selection-root].

Then read [Repository local state](local-state). It explains what lives outside
the committed wiki tree: the global database, user config, update lock, and
per-repository runtime directories under `~/.codealmanac/` [@local-state].

Use [Local state layout](../../reference/local-state-layout) for exact path
lookup [@local-state-layout]. Use [Only almanac root](../../decisions/only-almanac-root)
when a change would add alternate root scanning, migration behavior, or a custom
root surface [@only-root].

## Future Affiliation

[Repository affiliation belongs in repository service](../../decisions/repository-affiliation-belongs-in-repository-service)
records the proposed boundary for mapping temporary checkouts, worktrees, or
nested directories back to a registered repository [@affiliation]. That decision
extends repository selection without weakening the canonical exact-root model.

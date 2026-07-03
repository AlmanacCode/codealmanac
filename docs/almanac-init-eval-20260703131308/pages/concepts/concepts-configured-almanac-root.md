---
title: Configured Almanac Root
topics: [concepts, workspaces, wiki]
sources:
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: roots
    type: file
    path: src/codealmanac/services/workspaces/roots.py
  - id: models
    type: file
    path: src/codealmanac/services/workspaces/models.py
---

# Configured Almanac Root

The configured Almanac root is the repo-relative directory that owns a wiki's source files. New repos default to `almanac/`, while `docs/almanac/`, `.almanac/`, and other safe repo-relative roots are explicit choices stored on the workspace model [@agreement].

Runtime code must use `Workspace.almanac_path` instead of concatenating a literal folder. The model validates that `almanac_path` equals `root_path / almanac_root`, and root validation rejects absolute paths, `..`, and `~` [@models]. [[workspace-registry-and-root-resolution]] covers how workspaces are selected.

An initialized root is detected by `topics.yaml` plus `pages/`; directory existence or runtime artifacts are not enough [@roots]. Exact path locations live in [[user-and-repo-state-paths-reference]].

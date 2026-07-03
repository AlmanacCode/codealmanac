---
title: Filesystem Source Runtime
topics: [architecture, sources]
sources:
  - id: adapter
    type: file
    path: src/codealmanac/integrations/sources/filesystem/adapter.py
  - id: listing
    type: file
    path: src/codealmanac/integrations/sources/filesystem/listing.py
  - id: selection
    type: file
    path: src/codealmanac/integrations/sources/filesystem/selection.py
  - id: tests
    type: file
    path: tests/test_filesystem_directory_selection.py
---

# Filesystem Source Runtime

The filesystem runtime turns file and directory source refs into bounded text for prompts. The adapter supports `path.file`, `path.directory`, and missing path refs; it bounds single files, directory file counts, and total rendered characters [@adapter].

Directory material prefers Git listing when the selected directory is inside a Git worktree, then falls back to a bounded Python/pathspec walk when Git cannot answer [@listing]. Candidate ranking prioritizes changed and untracked files, role-bearing filenames such as `service.py` and `adapter.py`, and semantic directory diversity [@selection].

This runtime is a concrete adapter behind [[source-resolution-and-runtimes]]. When changing selection policy, run the filesystem source and directory-selection tests [@tests].

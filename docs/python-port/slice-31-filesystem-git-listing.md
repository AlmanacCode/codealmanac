# Slice 31 - Filesystem Git Directory Listing

## Scope

Improve filesystem directory runtime for Git worktrees.

When a selected directory is inside a Git worktree, the filesystem runtime uses
Git to list tracked files plus untracked files that are not ignored:

```text
git ls-files -z --cached --others --exclude-standard --full-name -- <path>
```

The Python directory walk remains the fallback for non-Git directories or Git
command failures.

## Out Of Scope

- No new source kind.
- No source catalog.
- No hosted behavior.
- No lifecycle workflow change.
- No semantic file ranking.
- No file-content preview in the viewer.

## Design

The service contract remains unchanged:

```python
runtime = app.sources.inspect_runtime(
    InspectSourceRuntimeRequest(cwd=repo, ref=directory_ref)
)
```

The integration chooses the listing mechanism:

```python
git_paths = git_directory_files(root, cwd, runner)
paths = git_paths if git_paths is not None else walk_files(root, cwd, ignore_spec)
```

`FilesystemSourceRuntimeAdapter` now takes an explicit `CommandRunner`. This is
the same manual dependency-injection shape used elsewhere in the port: runtime
mechanics stay behind integration adapters, and tests can inject or exercise
the command boundary without monkeypatching product code.

## Why Git

Git already owns the practical ignore model for repositories: nested
`.gitignore`, `.git/info/exclude`, global excludes, tracked files, and untracked
but not ignored files. Reimplementing that in Python would be a weaker copy of
Git's contract.

The adapter still applies CodeAlmanac's default directory skips after Git
listing, so tracked `.almanac/`, `.gitignore`, `.env`, and generated/private
paths stay out of prompt material.

## Verification

- Focused filesystem tests cover:
  - non-Git fallback reports `listing_source: walk`
  - Git worktree directory reports `listing_source: git`
  - Git listing includes staged tracked files
  - Git listing includes untracked non-ignored files
  - nested `.gitignore` exclusions are respected
  - CodeAlmanac default skips still remove private/generated paths
- Source/ingest/architecture focused tests confirm the runtime seam remains
  source-kind agnostic.

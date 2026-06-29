# Slice 15: Ingest Mutation Safety

## Scope

Harden internal ingest before making `codealmanac ingest` public.

The workflow now audits filesystem mutation around a harness run:

```python
preflight = mutation_policy.preflight(workspace)
harness = harnesses.run(...)
safety = mutation_policy.validate(preflight, workspace, harness.changed_files)
```

The policy is local and Git-backed:

- require Git change tracking before AI lifecycle writes
- require `.almanac/` to be clean before the run starts
- allow pre-existing dirty application files as source material
- fail if any non-`.almanac/` path changes during the run
- fail if the harness reports a changed file outside `.almanac/`

## Architecture

`services/workspaces` owns the typed workspace change-state port because it is
repo/worktree state. The concrete Git implementation lives in
`integrations/workspaces/git`.

```text
workflows/ingest
  -> IngestMutationPolicy
    -> services/workspaces/WorkspaceChangeProbe protocol
      -> integrations/workspaces/git/GitWorkspaceChangeProbe
```

`app.py` wires the Git probe into `IngestMutationPolicy`. CLI, workflows, and
services still do not import concrete integrations.

## Cosmic Python Translation

Chapter 6 describes Unit of Work as an abstraction over atomic operations with
a stable snapshot and commit/rollback boundary. CodeAlmanac filesystem writes
cannot honestly roll back like a database transaction. This slice borrows the
snapshot boundary but does not fake rollback: Git status before/after the
harness run is the audit surface, and unsafe mutation fails the run.

## Behavior

Dirty app code remains usable:

```text
src/app.py modified before ingest -> allowed if unchanged by the run
src/app.py modified by the harness -> run fails
```

Dirty wiki state is not allowed:

```text
.almanac/pages/foo.md modified before ingest -> preflight fails
```

This protects user-authored wiki edits from being silently merged with an agent
run and gives the run ledger a clear failure reason.

## Tests

- Git porcelain status parser handles renames and untracked paths.
- Ingest succeeds with pre-existing dirty app code when the harness leaves it
  unchanged.
- Ingest fails when the harness mutates a dirty app file without reporting it.
- Ingest fails when `.almanac/` is dirty before the run.
- Ingest fails outside a Git worktree.
- Architecture test still prevents CLI/workflows/services from importing
  integrations.

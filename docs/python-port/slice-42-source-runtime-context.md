# Slice 42 - Source Runtime Context

## Scope

Filesystem directory source runtime must ignore the configured repo wiki root
when Ingest uses a repo directory as selected material.

The root is configurable, so the filesystem adapter cannot keep a baked-in list
of CodeAlmanac roots.

## Shape

`IngestWorkflow` resolves the workspace first.

```text
workspace.almanac_root
  -> SourceRuntimeContext(ignored_directories=(...))
  -> InspectSourceRuntimeRequest
  -> SourceRuntimeAdapter.inspect(...)
```

`SourceRuntimeContext` is service-owned request data. The filesystem adapter
translates it into `pathspec` ignore patterns for both traversal paths:

- Git-backed directory listing
- Python/pathspec directory walking

The default generated/private ignore list still covers local machinery such as
`.git/`, `node_modules/`, virtualenvs, cache directories, `.env`, and
`.gitignore`. It does not name `almanac/`, `docs/almanac/`, or `.almanac/`.

## Tests

- direct filesystem runtime skips a custom root such as `knowledge/`
- Git-backed filesystem runtime skips the same custom root
- Ingest passes the resolved `workspace.almanac_root` into source runtime
- `SourceRuntimeContext` rejects absolute, current-directory, and parent-path
  ignores

## Cosmic Python Note

This follows the service-layer boundary: workflow code owns the product context,
while the adapter owns translation to external mechanics.

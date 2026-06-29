# Slice 30 - Viewer File Route

## Scope

Add the read-only viewer route that answers: which wiki pages mention this file
or folder reference?

This restores the old local viewer's `/file?path=...` contract without adding a
source-code browser.

## Out Of Scope

- No file-content preview.
- No source runtime reuse.
- No AI calls.
- No wiki writes.
- No hosted or remote file access.

## Design

`ViewerService` owns the browser payload:

```python
result = app.viewer.file(
    ViewerFileRequest(cwd=repo, path="src/auth/session.py")
)
```

The service delegates matching to the existing SQLite read model:

```python
pages = index.search(
    workspace.workspace_id,
    SearchIndexRequest(mentions=request.path, limit=request.limit),
)
```

The HTTP route stays query-shaped:

```text
GET /api/file?path=src/auth/session.py
```

File and folder paths contain `/`, so using a query parameter avoids route-path
ambiguity and matches the old viewer contract.

## Boundary Notes

- `ViewerFileRequest` validates the path as a wiki reference path, not as an
  actual filesystem path.
- Parent traversal such as `../secret.txt` is rejected before the index query.
- Folder refs keep the trailing slash.
- The index keeps owning GLOB-safe file/folder mention semantics.
- The frontend links page rail file references to `#/file/<path>`.

## Verification

- Focused viewer service and server tests cover file refs, folder refs, and
  invalid parent traversal.
- Full verification should include full pytest, ruff, diff check, live serve API
  dogfood, and package asset inspection.

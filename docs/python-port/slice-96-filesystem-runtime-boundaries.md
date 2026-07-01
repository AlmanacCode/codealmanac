# Slice 96 - Filesystem Runtime Boundaries

## Scope

Split `integrations/sources/filesystem/adapter.py` by responsibility without
changing filesystem source-runtime behavior.

## Read Before Coding

- `MANUAL.md`
- `.almanac/README.md`
- `docs/python-port-live-agreement.md`
- `docs/python-port/ownership-map.md`
- `docs/reference/cosmic-python/chapter_04_service_layer.md`
- `docs/reference/cosmic-python/chapter_13_dependency_injection.md`
- `docs/reference/cosmic-python/CODEALMANAC.md`

Cosmic Python's useful line for this slice is chapter 13's "Explicit is better
than implicit." The filesystem adapter already has explicit injected command
execution; this slice keeps that seam while splitting the local implementation
details behind it.

## Shape

```python
FilesystemSourceRuntimeAdapter.inspect(request)
  -> documents.read_text_document(...)
  -> listing.read_directory_document(...)
  -> rendering.render_file_metadata(...)
  -> rendering.render_directory_files(...)
```

`adapter.py` remains the service-port implementation. It decides which source
kind is supported and turns documents into `SourceRuntime` values.

`documents.py` owns text-document models, text decoding, size truncation, and
unreadable-text errors.

`listing.py` owns directory material selection: ignore specs, Git listing,
Python walking, changed-file status parsing, and directory document assembly.

`rendering.py` owns prompt-facing filesystem runtime text.

`paths.py` owns display-path and relative-path helpers shared by documents and
listing.

## Out Of Scope

- No source-runtime output changes.
- No selection policy changes.
- No new public command behavior.
- No new filesystem crawling machinery.

## Tests

- Focused filesystem runtime tests.
- Focused filesystem selection tests.
- Architecture guard that keeps filesystem adapter small and split.
- Full pytest, ruff, and diff hygiene.

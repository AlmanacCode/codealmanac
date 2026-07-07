---
title: Add A Source Runtime Adapter
topics: [guides, sources]
sources:
  - id: source-port
    type: file
    path: src/codealmanac/services/sources/ports.py
    note: Service-owned runtime adapter protocol.
  - id: sources-service
    type: file
    path: src/codealmanac/services/sources/service.py
    note: Source resolution, transcript discovery, and runtime inspection service.
  - id: source-models
    type: file
    path: src/codealmanac/services/sources/models.py
    note: Source reference and runtime models.
  - id: source-requests
    type: file
    path: src/codealmanac/services/sources/requests.py
    note: Source runtime request and context models.
  - id: filesystem-adapter
    type: file
    path: src/codealmanac/integrations/sources/filesystem/adapter.py
    note: Filesystem runtime adapter example.
  - id: github-adapter
    type: file
    path: src/codealmanac/integrations/sources/github/adapter.py
    note: GitHub runtime adapter example.
  - id: source-defaults
    type: file
    path: src/codealmanac/integrations/sources/__init__.py
    note: Default source runtime adapter registration.
  - id: app-root
    type: file
    path: src/codealmanac/app.py
    note: Composition root injection surface for source adapters.
  - id: source-tests
    type: file
    path: tests/test_sources_service.py
    note: Service tests for source resolution and runtime inspection.
---

# Add A Source Runtime Adapter

Use this guide when CodeAlmanac can already describe a source as a `SourceRef`, but needs a new way to inspect that source at runtime. A source runtime adapter turns one typed source reference into bounded text, diagnostics, and status for ingest prompts. It belongs under `integrations/sources/`; the service contract stays in `services/sources/` [@source-port].

The successful outcome is small: `SourcesService.inspect_runtime(...)` finds the adapter through `supports(ref)`, returns a `SourceRuntime`, and downstream workflows never touch raw provider payloads [@sources-service]. If the work also introduces a new address form, update the source address resolver first and keep the new runtime adapter behind the same service-owned boundary. See [Source resolution and runtime](../architecture/sources/source-resolution-and-runtime), [Source material](../concepts/source-material), and [Source addresses](../reference/sources/source-addresses) for the surrounding model.

## Locate The Source Kind

Start with the `SourceKind` and `SourceRef` shape. `SourceRef` carries the normalized identity plus optional fields such as path, URL, repository, number, revision range, transcript id, existence, and fingerprint [@source-models]. The runtime adapter should use those fields, not re-parse the original source string.

If the source kind already exists, the adapter only needs runtime support. If the source kind does not exist, add the kind and address resolution before writing the adapter. The guide is about the second step: taking a typed ref and loading usable source material.

## Implement The Adapter

Create the adapter under the integration family that owns the outside system. The adapter must implement `SourceRuntimeAdapter`: `supports(ref)` answers whether the adapter owns a ref, and `inspect(request)` returns a `SourceRuntime` [@source-port].

Use the filesystem and GitHub adapters as the model. `FilesystemSourceRuntimeAdapter.supports(...)` accepts file, directory, and unknown path refs, then delegates to file or directory inspection [@filesystem-adapter]. `GitHubSourceRuntimeAdapter.supports(...)` accepts pull request and issue refs, calls a GitHub client, and converts failures into unavailable runtimes instead of leaking raw exceptions [@github-adapter].

The adapter output should be bounded and explicit. `SourceRuntime` has `AVAILABLE`, `SKIPPED`, and `UNAVAILABLE` statuses, optional content, diagnostics, and a truncation flag [@source-models]. Return `UNAVAILABLE` when the adapter owns the ref but cannot load it. Return `SKIPPED` only for a ref the adapter does not actually handle.

## Respect Runtime Context

`InspectSourceRuntimeRequest` carries `cwd`, `ref`, and `SourceRuntimeContext` [@source-requests]. Use `cwd` as the repository root for relative display and subprocess work. Use context fields only for adapter-neutral runtime concerns, such as ignored directories for filesystem listing [@source-requests].

Do not pass provider-native objects into services or prompts. Parse external data at the adapter edge and render the bounded runtime text there. The GitHub adapter catches command, validation, and JSON errors, then returns a CodeAlmanac runtime object [@github-adapter]. That is the expected shape.

## Register It

Add the adapter to `default_source_runtime_adapters()` when it should be available in normal app construction [@source-defaults]. The composition root passes either the default adapters or test-supplied adapters into `SourcesService` [@app-root].

For tests, pass the adapter directly through `create_app(source_runtime_adapters=(...))`. The source tests do this for `GitSourceRuntimeAdapter`, which proves the service can inspect a diff and a revision range without depending on every production adapter [@source-tests].

## Verify The Change

Add focused service tests. A good test resolves or constructs the source ref, calls `app.sources.inspect_runtime(...)`, and checks the returned status plus a stable part of the content or diagnostic [@source-tests].

Run:

```bash
uv run pytest tests/test_sources_service.py
uv run pytest tests/test_architecture.py
uv run ruff check .
```

If architecture tests fail because a service imports `integrations`, move the provider-specific code back behind the port. The service layer should select adapters by the port contract; integrations should do the outside-world work.

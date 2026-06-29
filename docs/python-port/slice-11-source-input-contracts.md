# Slice 11: Source Input Contracts

## Scope

Add the service-owned input contract future lifecycle workflows will consume:

```python
app.sources.resolve(
    ResolveSourcesRequest(
        cwd=Path.cwd(),
        inputs=("notes.md", "github:pr:42", "git:range:main..feature"),
    )
)
```

This slice does not add public `codealmanac ingest` yet. A public ingest command
that only resolves inputs would mislead users because no harness execution,
foreground/background worker, or wiki-writing workflow exists yet.

## Product Semantics

`source` means raw material CodeAlmanac can learn from. It is not page
provenance and it is not a source of truth. This slice models operation input:
raw address, parsed reference, and operation-facing brief.

Supported addresses:

- local files, directories, and missing paths
- `github:pr:<number>`
- `github:issue:<number>`
- GitHub pull request and issue URLs
- generic HTTP(S) URLs
- `git:range:<base>..<head>`
- `git:diff` and `git:diff:<target>`
- `transcript:<id-or-path>`

## Architecture

Cosmic Python chapter 11 treats outside-world messages as something to translate
at the boundary before the core handles typed messages. For CodeAlmanac, raw
ingest inputs are external messages:

```text
raw user input
  -> services/sources/SourceAddress
  -> services/sources/SourceRef
  -> services/sources/SourceBrief
  -> future workflows/ingest
```

`SourcesService` owns parsing and local source observations such as file
existence and file fingerprints. It does not decide whether a source is notable,
does not write pages, does not fetch GitHub, and does not create run records.

## Library Decision

URL decomposition uses Python's standard `urllib.parse.urlsplit` instead of
regexing URLs. HTTP URL validity uses Pydantic's `AnyHttpUrl` adapter because
`urlsplit` is a parser, not a validator. The shaped contracts use Pydantic
models and field validators, matching the live agreement's validation rule.

References:

- https://docs.python.org/3/library/urllib.parse.html#urllib.parse.urlsplit
- https://docs.pydantic.dev/latest/concepts/validators/

## Tests

- local file, directory, and missing path resolution
- GitHub shorthand refs and GitHub URLs
- generic web URL resolution, normalization, and malformed URL rejection
- git range, git diff, and transcript refs
- malformed explicit source refs
- empty source input validation

## Remaining Risk

Shorthand GitHub refs do not infer `owner/repo` yet. That belongs with the
Git/GitHub integration adapter because it must inspect repository remotes and
credentials. This slice only defines the stable local input contract.

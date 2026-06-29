# Slice 25: GitHub Source Runtime

## Intent

GitHub PR and issue inputs already resolve into typed source refs. Ingest should
also receive readable runtime material for those refs before the harness starts.

This slice adds a GitHub source runtime adapter behind the existing
`SourceRuntimeAdapter` port.

## Scope

- Support `github:pr:<number>` and GitHub pull request URLs.
- Support `github:issue:<number>` and GitHub issue URLs.
- Use GitHub CLI as the local integration boundary.
- Validate `gh --json` output with Pydantic models at the adapter edge.
- Include PR metadata, comments, reviews, commits, files, and patch text.
- Include issue metadata, labels, assignees, and comments.
- Keep bounded prompt text using the same truncation rule as Git runtime.

## Out Of Scope

- Hosted GitHub app integration.
- Webhook ingestion.
- GitHub writes, mutations, labels, or comments.
- Background sync changes.
- A Python SDK or MCP surface.

## Design Decision

Use `gh`, not a Python HTTP client, for this local product slice.

The local CLI already lives on developer machines where `gh` is the common
GitHub auth and repository-context boundary. `gh pr view --json` and
`gh issue view --json` provide structured data; `gh pr diff --patch --color
never` provides patch text. This avoids hand-rolled REST authentication while
still keeping raw external JSON inside `integrations/sources/github`.

Shorthand refs without a repository keep using `gh`'s current-repository
resolution from the selected workspace. URL refs are self-contained.

## Files

- `src/codealmanac/integrations/sources/github/adapter.py`
- `src/codealmanac/integrations/sources/__init__.py`
- `tests/test_github_source_runtime.py`
- `tests/test_ingest_workflow.py`
- steering docs under `docs/python-port/`

## Verification

- Focused GitHub source runtime tests.
- Ingest prompt test proving GitHub runtime reaches the harness prompt.
- Full pytest.
- Full ruff.
- `git diff --check`.
- Live dogfood with public GitHub PR/issue refs when `gh` is available.

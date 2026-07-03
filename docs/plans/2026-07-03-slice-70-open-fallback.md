# Slice 70: Preserve unauthenticated `open` handoff

## Scope

Fix the public `codealmanac open` contract after the Slice 69 dashboard-route
repair.

`codealmanac open` should have two paths:

- signed-in CLI auth present: resolve the repository through the cloud API and
  open the exact dashboard wiki route
- no local CLI auth: open the hosted `/wiki/github/<owner>/<repo>` resolver so
  the browser can handle login/onboarding

## Out Of Scope

- Do not change WorkOS/AuthKit.
- Do not rework `/wiki/github` frontend routing unless the browser pressure
  test proves it is still broken.
- Do not add new setup prompts.
- Do not change local lifecycle commands.

## Design

The service-layer chapter says the service layer captures use cases between
entrypoints and domain details. The dependency-injection chapter points to
explicit dependencies and composition-root wiring. This slice keeps that shape:
the CLI stays thin, `CloudOpenWorkflow` owns the product choice, and the
existing `CloudRepositoriesService` remains the API-backed resolver.

```python
checkout = repository_probe.read(cwd)

if target == "wiki":
    try:
        repository = cloud_repositories.resolve(full_name)
        url = dashboard_wiki_url(repository)
    except NotFoundError as exc if exc.resource == "cloud auth state":
        url = public_wiki_resolver_url(owner, repo)
else:
    url = existing_repo_setup_or_github_target(...)
```

Only missing local cloud auth falls back. A real cloud repository/API failure
must not be hidden as a browser handoff.

## Files

- `src/codealmanac/workflows/cloud_open/service.py`
- `tests/test_cloud_open_workflow.py`
- `tests/test_cli.py`
- `docs/codealmanac-launch/cli-contract.md`
- launch worklog/progress/verification/next-agent notes after verification

## Verification

- `HOME=$(mktemp -d) codealmanac open --no-browser` should print the hosted
  resolver URL instead of failing.
- Logged-in installed `codealmanac open --no-browser` should still print the
  dashboard wiki URL.
- Focused tests:
  `uv run pytest tests/test_cloud_open_workflow.py tests/test_cli.py -q`
- Full local gates:
  `uv run pytest`
  `uv run ruff check .`
  `git diff --check`
- Browser check if needed:
  open the no-auth resolver URL and verify it reaches login or the dashboard,
  not a 404.

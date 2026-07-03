# Slice 78 Plan: Root Cloud Status

## Read Before Coding

- `MANUAL.md`
- `docs/codealmanac-launch/cli-contract.md`
- `docs/reference/cosmic-python/chapter_04_service_layer.md`
- `docs/reference/cosmic-python/chapter_10_commands.md`

## Problem

The launch CLI contract names `codealmanac status`, but root help does not
expose it. Users currently need to know three separate commands:

```text
codealmanac whoami
codealmanac repo status
codealmanac capture status
```

That is too much for first-run and agent-run diagnostics. Root setup is now
cloud-first, so root status should answer the same cloud-first question:

```text
Am I signed in, does this checkout resolve to a cloud repo, and is capture
configured on this machine?
```

## Scope

- Add public `codealmanac status [--api-url URL] [--check-cloud] [--json]`.
- Add a `workflows/cloud_status` use-case that composes existing status
  providers:
  - `CloudAuthService.status`
  - `CloudRepoWorkflow.status`
  - `CloudCaptureService.status`
- Render a compact human summary and a typed JSON model.
- Add CLI contract, worklog, progress, verification, and handoff notes.
- Bump the public package to `0.1.8` after verification because this adds a
  user-visible root command.

## Out Of Scope

- Do not add a hosted API endpoint.
- Do not change repository trigger/delivery behavior.
- Do not install or repair capture hooks from `status`.
- Do not make status block on cloud capture by default. Use `--check-cloud` for
  remote capture credential lookup because that calls the cloud API.

## Design

Root status is a workflow, not CLI machinery:

```python
result = app.workflows.cloud_status.status(
    ReadCloudStatusRequest(
        cwd=Path.cwd(),
        api_url=args.api_url,
        check_capture_cloud=args.check_cloud,
    )
)
```

The workflow returns a typed aggregate:

```python
class CloudStatusOverview(CodeAlmanacModel):
    auth: CloudStatus
    repo: CloudRepoStatusResult | None
    capture: CaptureStatus
```

Rules:

- Auth status always runs.
- Repo status runs only when auth is authenticated. If auth is missing, root
  status should not call cloud repo APIs with no token.
- Capture status always runs locally. It checks local credential and hooks even
  when auth is missing.
- `--check-cloud` asks capture status to include remote capture credentials only
  when auth is authenticated.

Human output should be readable, not a wall:

```text
Cloud: signed in as rohans0509
Repository: AlmanacCode/codealmanac dev
Triggers: 3
Capture: credential missing
Providers: none
```

If repo checkout is unavailable:

```text
Repository: unavailable
Reason: not inside a Git checkout
```

If auth is missing:

```text
Cloud: signed out
Run: codealmanac login
```

## Files

- `src/codealmanac/workflows/cloud_status/`
- `src/codealmanac/app.py`
- `src/codealmanac/cli/parser/admin.py`
- `src/codealmanac/cli/dispatch/admin.py`
- `src/codealmanac/cli/dispatch/cloud_status.py`
- `src/codealmanac/cli/render/cloud_status.py`
- `tests/test_cli.py`
- `tests/test_public_contract.py`
- `README.md`
- `pyproject.toml`
- `uv.lock`
- `docs/codealmanac-launch/*.md`

## Verification

```bash
uv run pytest tests/test_cli.py::test_cli_root_status_reports_cloud_repo_and_capture \
  tests/test_cli.py::test_cli_root_status_json_reports_signed_out_capture \
  tests/test_public_contract.py -q
uv run ruff check src/codealmanac/cli src/codealmanac/workflows/cloud_status tests/test_cli.py tests/test_public_contract.py
git diff --check
```

After implementation, run an installed/public-style smoke from the local tree:

```bash
uv run codealmanac status --json
uv run codealmanac status
```

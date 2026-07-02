# Slice 54: PyPI Release Execution

Status: implemented with external provider blocker.
Date: 2026-07-02.

## Scope

Execute the stable PyPI release path for `codealmanac` `0.1.0` and prove that
users can install the CLI from PyPI.

This slice covers:

- verify `.github/workflows/publish.yml` exists on GitHub `main`
- verify the current PyPI project state before publishing
- run the manual `publish` workflow on `main` with `confirm_version=0.1.0`
- fix any release-blocking test failure exposed by the workflow
- wait for the workflow result and capture the exact evidence
- if publish succeeds, install `codealmanac` from PyPI into a clean
  environment and smoke the CLI
- if publish fails because PyPI Trusted Publishing is not configured, record the
  provider-side blocker exactly
- update launch progress, worklog, verification matrix, and next-agent brief

This slice does not cover:

- changing package contents or CLI behavior
- bypassing Trusted Publishing with a PyPI API token
- publishing a dev/pre-release version
- broad production browser verification

## Design

The default release path is the trusted PyPA path already encoded in the
workflow:

```text
GitHub Actions workflow_dispatch
  -> validate ref/version
  -> run pytest/ruff/diff/build/twine checks
  -> pypa/gh-action-pypi-publish@release/v1
  -> PyPI project release
  -> clean user install smoke
```

No local token, Doppler token, or hand-rolled upload path should be used. If the
trusted publisher entry is missing in PyPI, the workflow failure is the correct
evidence and the remaining action belongs in the PyPI dashboard.

## Files

Expected CodeAlmanac docs updates:

- `docs/codealmanac-launch/next-agent-brief.md`
- `docs/codealmanac-launch/progress.md`
- `docs/codealmanac-launch/verification-matrix.md`
- `docs/codealmanac-launch/worklog.md`

No code changes are expected unless verification exposes a concrete release
contract bug.

## Verification

Preflight:

```text
git status --short
git rev-parse HEAD origin/main
gh workflow list --repo AlmanacCode/codealmanac
gh workflow view publish.yml --repo AlmanacCode/codealmanac
python -m pip index versions codealmanac
```

Publish:

```text
gh workflow run publish.yml \
  --repo AlmanacCode/codealmanac \
  --ref main \
  -f confirm_version=0.1.0

gh run watch <run-id> --repo AlmanacCode/codealmanac --exit-status
gh run view <run-id> --repo AlmanacCode/codealmanac --log-failed
```

Fresh install smoke, only if publish succeeds:

```text
python3.12 -m venv /tmp/codealmanac-pypi-smoke
/tmp/codealmanac-pypi-smoke/bin/python -m pip install --upgrade pip
/tmp/codealmanac-pypi-smoke/bin/python -m pip install codealmanac==0.1.0
/tmp/codealmanac-pypi-smoke/bin/codealmanac --version
/tmp/codealmanac-pypi-smoke/bin/codealmanac --help
```

Docs:

```text
git diff --check
```

## Result

First workflow run `28617718053` failed in tests and exposed a real local
attach-stream race. Commit `a0c86bfe6bedfdd2cd7bd8ff21c252692a6c4eb6` fixes the
race and is pushed to `dev` and `main`.

Second workflow run `28617914312` passed the build job but failed in PyPI token
exchange with `invalid-publisher`. PyPI still exposes only `0.1.0.dev0`, so the
fresh install smoke is blocked until the PyPI trusted publisher entry matches:

```text
repository: AlmanacCode/codealmanac
workflow: .github/workflows/publish.yml
ref: refs/heads/main
environment: pypi
subject: repo:AlmanacCode/codealmanac:environment:pypi
```

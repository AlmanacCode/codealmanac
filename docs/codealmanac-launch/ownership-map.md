# Ownership Map

Status: active.

## `codealmanac`

Owns:

- human CLI
- shared update engine
- engine request/result models
- source bundle contract
- local setup
- local control DB at `~/.codealmanac/control.sqlite`
- local query DB for wiki read/search
- local capture storage
- local Git hook dispatchers
- local worker workspace creation
- deterministic local delivery
- auto-update client behavior

Does not own:

- dashboard UI
- GitHub App installation control plane
- team/account permissions
- billing
- Render/Vercel/Modal deployment config
- cloud-only auth policy

## `codealmanac-hosted`

Owns:

- cloud dashboard
- backend API
- GitHub App webhooks and installation state
- account/team permission checks
- billing
- cloud source capture API
- repository setup and trigger policy
- cloud run queue
- cloud `runs` and `run_events`
- cloud worker orchestration
- PR/commit delivery through GitHub
- hosted wiki reader routes
- Render, Vercel, Modal, Supabase, Doppler, PostHog, and Autumn config

Does not own:

- a forked wiki-writing algorithm
- local control DB
- local Git hooks
- local machine provider installation

## Shared Boundary

```text
engine request
  repo_path
  sources_path
  run_path
  branch/repo identity
  expected_head_sha
  almanac_root

engine result
  status
  summary
  commit_subject
  commit_body
  changed_files
  event/artifact refs
```

Both cloud and local workers call this boundary.


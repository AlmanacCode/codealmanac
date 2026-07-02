# Repo Organization

Status: active.

There are two repos.

```text
codealmanac
  shared update engine
  public CLI
  local setup
  local control DB
  local source capture
  local git hooks
  local worker/worktree execution
  local delivery
  query/index DB
  package consumed by cloud workers

codealmanac-hosted
  cloud frontend
  backend API
  GitHub App integration
  account/team permissions
  billing
  cloud source capture API
  trigger policy UI/API
  cloud run queue
  worker orchestration
  cloud run event storage
  PR/commit delivery
  provider deployment config
```

`codealmanac-hosted` is the renamed and evolved `../usealmanac` repository, not
a greenfield frontend.

## Dependency Direction

`codealmanac-hosted` may depend on `codealmanac`.

`codealmanac` must not depend on `codealmanac-hosted`.

The hosted worker uses `codealmanac` by package dependency. In development this
can be an editable local path. In production it should be a pinned version or
git SHA.

Launch decision: pin by git SHA first.

## Shared Contract

Both local and cloud workers call the shared engine contract:

```text
request:
  repo_path
  sources_path
  run_path
  repository identity
  branch identity
  expected_head_sha
  almanac root

result:
  status
  summary
  commit subject/body
  changed files
  artifact refs
  event refs
```

The human CLI is above this contract. It is not the contract itself.

Source material is always passed by reference. The request contains paths,
storage refs, ids, or artifact handles. It must not inline full conversation
sessions, source files, or source bundles as value payloads.

The agent/model owns judgment through prompts. Do not add deterministic
preprocessing stages that try to replace the model's source-reading judgment
unless there is a measured failure case.

## Launch Refactor Rule

If the existing `codealmanac` code is too local-only for a feature, reshape it so
the engine/local/cloud boundary is explicit before adding the feature. Do not add
cloud-specific branches into local-only modules.

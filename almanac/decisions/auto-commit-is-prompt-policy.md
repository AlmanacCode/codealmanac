---
title: Auto-Commit Is Prompt Policy
topics: [decisions, lifecycle, prompts]
sources:
  - id: live_agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active decision that auto-commit is prompt permission, not Python-side Git orchestration.
  - id: commit_policy
    type: file
    path: src/codealmanac/workflows/operations/commit.py
    note: Operation source-control policy rendered into lifecycle prompts.
  - id: build_workflow
    type: file
    path: src/codealmanac/workflows/build/service.py
    note: Build prompt payload includes operation commit policy.
  - id: ingest_workflow
    type: file
    path: src/codealmanac/workflows/ingest/service.py
    note: Ingest prompt payload includes operation commit policy.
  - id: garden_workflow
    type: file
    path: src/codealmanac/workflows/garden/service.py
    note: Garden prompt payload includes operation commit policy.
  - id: operation_service
    type: file
    path: src/codealmanac/workflows/operations/service.py
    note: Operation runner completion path after harness execution.
  - id: kernel
    type: file
    path: src/codealmanac/prompts/base/kernel.md
    note: Base prompt instruction to follow runtime source_control policy.
  - id: architecture_tests
    type: file
    path: tests/test_architecture.py
    note: Tests forbidding Python-side Git committer and staging mechanisms.
---

# Auto-Commit Is Prompt Policy

CodeAlmanac treats auto-commit as permission given to the lifecycle agent, not as a Python-side Git committer. The Python code renders a `source_control` policy into build, ingest, and Garden prompts. The agent may then use normal Git commands if the policy allows it, but CodeAlmanac does not stage files or run `git commit` itself [@live_agreement][@commit_policy].

This decision keeps authorship and judgment together. Lifecycle agents decide what wiki source changed and whether it is worth committing within the allowed policy. Python records the harness run, refreshes the index, and validates the wiki after harness success; it does not become a separate commit orchestration pipeline [@operation_service].

## Context

The active Python agreement states the rule directly: intelligence lives in prompts, and auto-commit is prompt policy rather than CodeAlmanac staging or smart Git orchestration [@live_agreement]. It also records the default as `auto_commit = true`, with `setup --no-auto-commit` and `config set auto_commit false` changing only the prompt permission [@live_agreement].

The base prompt follows the same contract. It tells the agent to follow the runtime `source_control` policy, and if committing is allowed, to use normal Git commands and commit only the allowed wiki source files named by that policy [@kernel]. The broader prompt and manual packaging path is described in [Prompts and manuals](../architecture/runtime-resources/prompts-and-manuals).

## Decision

`operation_commit_policy` builds a typed policy object with `auto_commit`, allowed files, forbidden files, a commit-message shape, and human-readable instructions [@commit_policy]. When auto-commit is enabled, the instructions allow committing wiki source changes, require normal Git commands from the repository root, restrict commits to allowed wiki source files, and forbid committing runtime state, application source, logs, or unrelated files [@commit_policy].

When auto-commit is disabled, the instructions tell the agent not to commit, to leave wiki source changes in the working tree, not to stage files, and not to run `git commit` [@commit_policy]. The allowed source files are `almanac/**/*.md` and `almanac/topics.yaml`; user config under `~/.codealmanac/`, runtime state, application source files, logs, and unrelated repository files are forbidden [@commit_policy].

Build, ingest, and Garden all pass this policy into their prompt payloads [@build_workflow][@ingest_workflow][@garden_workflow]. The policy is therefore part of the operation context the agent reads, not an after-the-fact Python step.

## Consequences

Python does not own a committer abstraction. Architecture tests reject files named like `committer.py`, `git_committer.py`, `staging.py`, or `commit_service.py`, and they also fail if Python source contains direct `git add` or `git commit` command fragments [@architecture_tests].

The upside is a small lifecycle core. CodeAlmanac can render policy, run the harness, record events, refresh the index, validate the wiki, and mark the run terminal without splitting writing and committing into separate engines [@operation_service]. The cost is that commit quality depends on the agent following the prompt, so the policy must stay clear.

This decision is part of the same product stance as [No propose/apply or dry-run](no-propose-apply-or-dry-run): when judgment belongs to the agent, the product gives the agent real source material and clear constraints instead of building a second state machine around it.

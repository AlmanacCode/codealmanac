---
title: Work On Local Update Flow Guide
topics: [guides, local]
sources:
  - id: local-worker
    type: file
    path: src/codealmanac/workflows/local_worker/service.py
  - id: local-runs
    type: file
    path: src/codealmanac/workflows/local_runs/service.py
  - id: delivery
    type: file
    path: src/codealmanac/workflows/local_delivery/service.py
  - id: tests
    type: file
    path: tests/test_architecture.py
---

# Work On Local Update Flow Guide

Use this guide when changing `codealmanac local ...`, local triggers, detached worker preparation, local engine execution, or delivery. The safe outcome is a branch-aware flow that preserves [[local-control-db]] invariants and keeps Git mechanics in integrations.

## Steps

1. Identify the stage: setup/status/policy, trigger claim, worker workspace and source bundle preparation, engine execution, or delivery.
2. Keep orchestration in workflows. `LocalWorkerWorkflow` should remain the high-level prepare -> engine -> delivery sequence [@local-worker].
3. Keep durable run and trigger state in `ControlService`; do not write `control.sqlite` outside stores.
4. Keep Git worktree, patch, hook, and delivery subprocess mechanics in integrations. Architecture tests check that services/workflows do not import integrations [@tests].
5. Preserve stale-head checks and empty-patch skip behavior in delivery [@delivery].

## Verification

Run the local workflow tests for the stage you touched, plus `tests/test_control_service.py`, `tests/test_git_local_delivery.py`, and `tests/test_architecture.py`.

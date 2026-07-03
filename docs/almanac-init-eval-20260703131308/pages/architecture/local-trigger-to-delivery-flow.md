---
title: Local Trigger To Delivery Flow
topics: [architecture, local, workflows]
sources:
  - id: setup
    type: file
    path: src/codealmanac/workflows/local_setup/service.py
  - id: update
    type: file
    path: src/codealmanac/workflows/local_update/service.py
  - id: worker
    type: file
    path: src/codealmanac/workflows/local_worker/service.py
  - id: delivery
    type: file
    path: src/codealmanac/workflows/local_delivery/service.py
---

# Local Trigger To Delivery Flow

The local update flow starts with `local setup`, which records a GitHub repository, branch policy, Almanac root, delivery mode, and optional Git hooks in [[local-control-db]] [@setup]. Manual updates or Git hooks record trigger events against that branch.

`LocalUpdateWorkflow` refuses to start when the checkout is unavailable, unconfigured, disabled, or already has an active queued/running run; otherwise it records a manual trigger and calls the local worker [@update]. `LocalWorkerWorkflow` prepares one run, executes the local engine, and delivers the result only if the engine leaves the run running [@worker].

Delivery verifies branch/head freshness, rejects local PR mode, skips empty patches, applies patches to the working tree for `working_tree`, or commits for `commit` [@delivery]. Artifact preparation is in [[local-worker-artifact-flow]].

---
title: Local Worker Artifact Flow
topics: [architecture, local, runs]
sources:
  - id: prep
    type: file
    path: src/codealmanac/workflows/local_runs/service.py
  - id: workspaces
    type: file
    path: src/codealmanac/services/worker_workspaces/service.py
  - id: bundles
    type: file
    path: src/codealmanac/services/source_bundles/service.py
  - id: engine
    type: file
    path: src/codealmanac/services/engine_runs/service.py
---

# Local Worker Artifact Flow

The local worker artifact flow prepares an isolated run before an agent edits wiki files. `LocalRunPreparationWorkflow` claims the next trigger, reads the repository and branch, creates a detached worker workspace, materializes a source bundle, prepares an engine run request, and updates the control run with source and request references [@prep].

Worker workspace, source bundle, and engine run services are intentionally small boundaries. Workspaces own repo checkout paths, source bundles own copied source/session material, and engine runs own request/result artifacts [@workspaces] [@bundles] [@engine].

The flow feeds [[local-trigger-to-delivery-flow]]. Git worktree mechanics and patch delivery stay in integrations, matching [[services-workflows-integrations-boundary]].

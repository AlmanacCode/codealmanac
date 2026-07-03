---
title: Config, Diagnostics, And Updates
topics: [architecture, operations]
sources:
  - id: config
    type: file
    path: src/codealmanac/services/config/service.py
  - id: diagnostics
    type: file
    path: src/codealmanac/services/diagnostics/service.py
  - id: updates
    type: file
    path: src/codealmanac/services/updates/service.py
  - id: package
    type: file
    path: src/codealmanac/integrations/updates/package.py
---

# Config, Diagnostics, And Updates

Config, diagnostics, and updates are small operational services around the main wiki flows. Config reads CLI-facing settings from user and project config locations through the workspace-aware config service [@config].

Diagnostics checks install/runtime/manual-package readiness and selected wiki readiness through a `doctor` facade [@diagnostics]. Updates inspect package metadata, decide whether update is possible, and run the package-manager command through an injected runner [@updates].

The package integration reads install metadata and executes update commands through subprocess boundaries [@package]. State paths are in [[user-and-repo-state-paths-reference]], and release checks are in [[release-and-test-gates-reference]].

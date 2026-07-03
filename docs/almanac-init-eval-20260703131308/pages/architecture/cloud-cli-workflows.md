---
title: Cloud CLI Workflows
topics: [architecture, cloud, cli]
sources:
  - id: login
    type: file
    path: src/codealmanac/workflows/cloud_login/service.py
  - id: repo
    type: file
    path: src/codealmanac/workflows/cloud_repo/service.py
  - id: runs
    type: file
    path: src/codealmanac/workflows/cloud_runs/service.py
  - id: http
    type: file
    path: src/codealmanac/integrations/cloud/http.py
---

# Cloud CLI Workflows

Cloud CLI workflows are implemented even though the active Python rewrite began as local-first. Login starts a cloud auth session, optionally opens the browser, polls until complete/expired/timeout, and saves the token on success [@login].

Cloud repo workflows inspect the current GitHub checkout, resolve the cloud repository, read or update branch trigger policies, and return status models for CLI rendering [@repo]. Cloud runs workflows list/start/show/cancel/retry/log runs by combining current repo status with cloud run service calls [@runs].

The HTTP integration maps these workflows to `/v1/auth`, repository, capture, and run endpoints with typed response conversion [@http]. Exact endpoints are summarized in [[cloud-http-contract-reference]].

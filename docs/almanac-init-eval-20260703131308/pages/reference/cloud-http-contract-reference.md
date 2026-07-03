---
title: Cloud HTTP Contract Reference
topics: [reference, cloud]
sources:
  - id: http
    type: file
    path: src/codealmanac/integrations/cloud/http.py
  - id: auth
    type: file
    path: src/codealmanac/services/cloud_auth/models.py
  - id: runs
    type: file
    path: src/codealmanac/services/cloud_runs/models.py
---

# Cloud HTTP Contract Reference

This page summarizes the cloud HTTP client surface used by CLI workflows. [[cloud-cli-workflows]] explains how workflows call it.

## Endpoint Families

The HTTP client starts and polls CLI auth sessions through `/v1/auth/cli/start` and `/v1/auth/cli/sessions/{session_id}/poll`, and logs out through `/v1/auth/logout` [@http].

The same client implementation also maps capture credentials/upload, cloud repository resolution/trigger policy, and cloud run list/start/read/cancel/retry/log operations into typed models [@http].

## Status Models

Auth login statuses include `pending`, `authorized`, `complete`, and `expired` [@auth]. Cloud run statuses include queued/running/terminal-style values defined by the cloud run models, and log events use `status`, `message`, `tool`, `output`, and `error` kinds [@runs].

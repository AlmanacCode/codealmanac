---
title: Control DB Schema Reference
topics: [reference, local, sqlite]
sources:
  - id: schema
    type: file
    path: src/codealmanac/services/control/schema.py
  - id: models
    type: file
    path: src/codealmanac/services/control/models.py
---

# Control DB Schema Reference

This page lists the local control-plane SQLite schema. [[local-control-db]] explains how the database is used.

## Tables

- `repositories`: provider identity, owner/name/full_name, default branch, Almanac root, optional local root path, timestamps [@schema].
- `branches`: repository branch policy, trigger enabled flag, delivery mode, last seen/triggered heads, timestamps [@schema].
- `sessions`, `turns`, `turn_branches`: provider session and turn records linked to branch confidence [@schema].
- `trigger_events`: cloud/local/manual trigger rows with head SHA, previous head, payload ref, and pending/claimed/ignored/superseded status [@schema].
- `runs`: branch-scoped local worker runs with operation, status, expected head, artifact refs, summary, commit text, error, and timestamps [@schema].
- `run_events`: append-only event rows for a local run [@schema].
- `deliveries`: delivery mode, status, target ref, head/commit/PR outcome, summary/error, and timestamps [@schema].

## Enums

Delivery modes are `working_tree`, `commit`, and `pr`. Local run statuses are `queued`, `running`, `succeeded`, `failed`, `stale`, and `cancelled` [@models].

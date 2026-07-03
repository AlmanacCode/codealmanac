---
title: Local Control Database
topics: [architecture, local, persistence]
sources:
  - id: schema
    type: file
    path: src/codealmanac/services/control/schema.py
  - id: models
    type: file
    path: src/codealmanac/services/control/models.py
  - id: service
    type: file
    path: src/codealmanac/services/control/service.py
  - id: tests
    type: file
    path: tests/test_control_service.py
---

# Local Control Database

The local control database is `~/.codealmanac/control.sqlite`, the durable ledger for branch-aware local updates. Its schema includes repositories, branches, sessions, turns, turn-branch links, trigger events, runs, run events, and deliveries [@schema].

Models define delivery modes, trigger event kinds/statuses, run statuses, run event kinds, session providers, and records for each table [@models]. `ControlService` is a facade over the store and a Git-state probe for recording current checkout triggers [@service].

This database backs [[concepts-local-control-plane]] and the flow in [[local-trigger-to-delivery-flow]]. Exact table fields are listed in [[control-db-schema-reference]].

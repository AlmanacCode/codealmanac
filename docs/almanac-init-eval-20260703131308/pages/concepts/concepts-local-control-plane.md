---
title: Local Control Plane
topics: [concepts, local]
sources:
  - id: schema
    type: file
    path: src/codealmanac/services/control/schema.py
  - id: worker
    type: file
    path: src/codealmanac/workflows/local_worker/service.py
  - id: readme
    type: file
    path: README.md
---

# Local Control Plane

The local control plane is the branch-aware update system behind `codealmanac local ...`. It stores repositories, branches, trigger events, runs, run events, sessions, turns, and deliveries in `~/.codealmanac/control.sqlite` [@schema].

It is separate from repo-local lifecycle jobs. Local setup records a repository and branch policy, Git hooks or manual update create trigger events, the local worker claims one run, runs a harness in a detached workspace, and delivers wiki changes back to the working tree or a commit [@worker].

Use [[local-control-db]] for the database shape and [[local-trigger-to-delivery-flow]] for the runtime path.

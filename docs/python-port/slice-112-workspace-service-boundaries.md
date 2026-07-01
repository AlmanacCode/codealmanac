# Slice 112 - Workspace Service Boundaries

## Intent

Keep workspace behavior unchanged while making `WorkspacesService` read as the
workspace use-case facade. The current service file owns initialization target
selection, registration, resolving, registry listing/drop, selector matching,
path containment, name/id generation, and registry availability checks in one
303-line module.

Cosmic Python chapter 4 defines the service layer as the place for use cases
and workflow orchestration. This slice keeps that shape: `service.py` owns the
workspace verbs, while selector mechanics, identity generation, and registry
status policy move behind named collaborators.

## Scope

- Add `services/workspaces/identity.py` for workspace names and ids.
- Add `services/workspaces/selection.py` for registry selector matching and
  path containment.
- Add `services/workspaces/status.py` for registry availability status.
- Update `WorkspaceRegistryStore` to use the identity helper instead of
  importing back from `service.py`.
- Add an architecture test to prevent `service.py` from regrowing selector,
  identity, or status mechanics.

## Out Of Scope

- No registry schema change.
- No root discovery behavior change.
- No auto-drop behavior change.
- No new public commands.

## Verification

- Focused workspace/build/read-model tests.
- Focused architecture test.
- Service-level dogfood for init, path select, and drop missing.
- Full pytest, Ruff, and diff check before commit.

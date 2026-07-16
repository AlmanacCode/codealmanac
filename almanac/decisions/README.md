---
title: Decisions
topics: [decisions, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entry that defines decisions as architectural choices future work must respect.
  - id: local-only
    type: wiki
    path: decisions/local-only-python-product
    note: Decision that defines the local-only Python product shape.
  - id: root
    type: wiki
    path: decisions/only-almanac-root
    note: Decision that restricts repo wiki source to almanac/.
  - id: links-sources
    type: wiki
    path: decisions/markdown-links-and-sources
    note: Decision that separates Markdown page links from structured source evidence.
  - id: page-kind
    type: wiki
    path: decisions/no-page-kind-field
    note: Decision that defers a validated page-kind frontmatter field.
  - id: no-propose
    type: wiki
    path: decisions/no-propose-apply-or-dry-run
    note: Decision that rejects propose/apply and dry-run lifecycle flows.
  - id: auto-commit
    type: wiki
    path: decisions/auto-commit-is-prompt-policy
    note: Decision that treats auto-commit as lifecycle prompt policy.
  - id: model-catalog
    type: wiki
    path: decisions/controlled-model-catalog
    note: Decision that keeps supported harness models in a controlled catalog.
  - id: repo-affiliation
    type: wiki
    path: decisions/repository-affiliation-belongs-in-repository-service
    note: Proposed decision that gives the repository service ownership of checkout-to-repository affiliation.
  - id: telemetry-setup
    type: wiki
    path: decisions/telemetry-permission-is-final-setup-step
    note: Decision for setup ordering and telemetry consent behavior.
---

# Decisions

Decision pages record architectural choices that future work must respect or
explicitly supersede. The topic graph defines `decisions` as this repository's
neighborhood for choices that shape structure, workflows, and product surface
[@topics].

Read these pages before adding compatibility paths, lifecycle orchestration,
model selection behavior, page format changes, or root-selection behavior.

## Product Boundary

[Local-only Python product](local-only-python-product) is the base product
decision: CodeAlmanac is a local Python tool with repo-owned Markdown source
and machine-local runtime state [@local-only].

[Only Almanac root](only-almanac-root) narrows that shape to one wiki source
root: `almanac/`. It rejects `.almanac/`, `docs/almanac/`, custom roots, and
root migration shims as current product surfaces [@root].

## Wiki Format

[Markdown links and sources](markdown-links-and-sources) decides that page
navigation uses normal Markdown links and evidence uses structured `sources:`
entries with inline citations [@links-sources].

[No page-kind field](no-page-kind-field) decides that page type stays
expressed through folder placement and topics rather than a validated `kind`
frontmatter field, until a concrete behavior needs it [@page-kind].

## Lifecycle Execution

[No propose/apply or dry-run](no-propose-apply-or-dry-run) rejects lifecycle
proposal files, apply steps, dry-run rehearsals, and state machines between
writer and reviewer [@no-propose].

[Auto-commit is prompt policy](auto-commit-is-prompt-policy) decides that
auto-commit changes the instructions given to lifecycle agents; CodeAlmanac
does not stage, split, or commit wiki diffs itself [@auto-commit].

## Harness Models

[Controlled model catalog](controlled-model-catalog) decides that supported
runner models are owned by CodeAlmanac config and tests, not by provider
discovery or provider defaults [@model-catalog].

## Setup Consent

[Telemetry permission is final setup step](telemetry-permission-is-final-setup-step)
records the setup contract for the narrow telemetry exception: telemetry
permission comes after runner, model, instruction, maintenance, update, and
change-handling choices, with an explicit `telemetry.enabled` config setting
[@telemetry-setup].

## Repository Scope

[Repository affiliation belongs in repository service](repository-affiliation-belongs-in-repository-service)
is a proposed decision, not yet implemented. It records the intended
ownership boundary for mapping a transcript's working directory back to a
canonical registered repository, so that future worktree or nested-checkout
support lands as a repository-service method instead of Conductor-specific
sync logic [@repo-affiliation].

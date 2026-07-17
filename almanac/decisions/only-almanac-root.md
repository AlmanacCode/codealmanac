---
title: Only Almanac Root
topics: [decisions, wiki]
sources:
  - id: live_agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active agreement that repo-owned wiki data lives under almanac/ only.
  - id: roots
    type: file
    path: src/codealmanac/services/repositories/roots.py
    note: Repository root detection and default almanac root enforcement.
  - id: public_contract
    type: file
    path: tests/test_public_contract.py
    note: Tests that reject alternate roots and old public surface language.
---

# Only Almanac Root

CodeAlmanac uses `almanac/` as the only repo wiki root. The committed wiki source is a nested Markdown tree below that folder, and alternate roots such as `docs/almanac/`, `.almanac/`, custom roots, and root migration shims are retired [@live_agreement].

This decision makes page identity and repository detection simple. A repository counts as initialized when the default `almanac/` directory contains `topics.yaml` and `README.md`, and the root-setting helper rejects any non-default root [@roots].

## Status

Accepted. `require_default_almanac_root` and `initialized_repository_at` enforce `almanac/` as the only root, and public-contract tests reject alternate roots [@roots][@public_contract].

## Context

Earlier product shapes had old roots and compatibility paths. The current Python agreement says the happy path is the product path and explicitly drops old wiki roots, old page layouts, and root hopping [@live_agreement]. The public contract tests enforce this by rejecting `docs/almanac` and `.almanac` as valid roots and by checking that `init --root` is not accepted [@public_contract].

The root decision also follows the local-only product direction. Runtime state belongs under `~/.codealmanac/`, not inside the committed wiki tree, so `almanac/` can stay a clean source tree rather than hidden application storage [@live_agreement].

## Decision

The only supported repository wiki source root is `almanac/`. `DEFAULT_ALMANAC_ROOT` is `Path("almanac")`, and `require_default_almanac_root` returns that root for `None` while raising when the caller provides any other relative root [@roots].

Repository auto-detection is exact. `initialized_repository_at` checks the current path for `almanac/topics.yaml` and `almanac/README.md`; it does not walk into alternate wiki locations [@roots].

## Consequences

This decision simplifies [Repository selection and root](../architecture/repositories/selection-and-root), [Page identity](../architecture/wiki/page-identity), and [Local state layout](../reference/local-state-layout). Page identity can be the path under `almanac/` without `.md`, because there is only one authored source root to interpret [@live_agreement].

It also removes compatibility work. The tests forbid README and docs language that advertises `.almanac`, `docs/almanac`, `--root`, old state paths, or old aliases as supported surfaces [@public_contract]. Future code should not add fallback scanning or migration behavior for alternate roots unless a new decision reverses this one.

The tradeoff is that existing legacy wiki folders must be moved deliberately. CodeAlmanac does not silently read them as another active root.

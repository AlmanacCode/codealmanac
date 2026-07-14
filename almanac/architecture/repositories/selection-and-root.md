---
title: Repository Selection And Root
topics: [architecture, repositories, wiki]
sources:
  - id: repository-roots
    type: file
    path: src/codealmanac/services/repositories/roots.py
    note: Fixed almanac root, root validation, and initialized repository detection.
  - id: repository-service
    type: file
    path: src/codealmanac/services/repositories/service.py
    note: Selection behavior for read and operation flows.
  - id: repository-selection
    type: file
    path: src/codealmanac/services/repositories/selection.py
    note: Exact path matching, name matching, and path containment checks.
  - id: repository-models
    type: file
    path: src/codealmanac/services/repositories/models.py
    note: Repository model validation for almanac root and almanac path.
  - id: public-contract-tests
    type: file
    path: tests/test_public_contract.py
    note: Public contract tests for fixed root and removed root flag.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active decision that current-repo detection is exact and the wiki root is almanac only.
  - id: affiliation-decision
    type: file
    path: almanac/decisions/repository-affiliation-belongs-in-repository-service.md
    note: Decision page for future worktree and temporary checkout affiliation support.
---

# Repository Selection And Root

Repository selection is exact in this Python rewrite. Commands either operate on a named registered wiki or on the exact current directory when it is a registered repository root; CodeAlmanac does not walk parent directories to discover a nearby wiki [@live-agreement] [@repository-service]. The wiki root is fixed at `almanac/`, so repository identity and page identity are both anchored to one predictable tree [@repository-roots] [@public-contract-tests].

This design removes old root compatibility paths. A repository counts as initialized only when the current directory contains `almanac/topics.yaml` and `almanac/README.md` [@repository-roots]. That marker pair is the product boundary between an ordinary directory and a CodeAlmanac repo wiki.

## Fixed Almanac Root

`DEFAULT_ALMANAC_ROOT` is `Path("almanac")` [@repository-roots]. The validator `require_default_almanac_root(...)` rejects absolute paths, empty paths, paths containing `..` or `~`, and any value other than `almanac/` [@repository-roots]. The repository model repeats that validation and requires `almanac_path` to equal `root_path / almanac_root` [@repository-models].

The public contract tests enforce the same rule from the outside. They assert that `docs/almanac` and `.almanac` are rejected, and that `codealmanac init --root ...` is not a supported parser surface [@public-contract-tests]. That makes alternate roots a removed product shape, not a hidden option.

## Initialized Repository Detection

`initialized_repository_at(path)` normalizes the provided path, appends the fixed `almanac/` root, and returns a repository target only when that directory is initialized [@repository-roots]. Initialization means two marker files exist: `topics.yaml` and `README.md` under `almanac/` [@repository-roots].

Read selection can use that detection as a convenience. If a read command runs from a directory that is not already registered but does contain an initialized wiki, `read_repository_at(...)` registers it and returns the repository [@repository-service]. Operation selection is stricter: `select_for_operation(...)` requires the exact current directory to already be registered unless the user names a repository [@repository-service].

## Name And Path Selection

Named selection goes through the repository registry. `select_by_name(...)` lists stored repository rows and matches names case-insensitively; duplicate case-insensitive matches are treated as ambiguous [@repository-service] [@repository-selection]. Exact path selection normalizes both sides before comparing, so equivalent filesystem spellings resolve to the same stored root [@repository-selection].

The service also validates paths against the selected repository. `validate_path(...)` normalizes the candidate path and rejects it if it is outside the repository root [@repository-service]. That check protects workflows that receive paths from CLI arguments or source resolution.

## Consequences

The main consequence is clarity. A CodeAlmanac repository has one root path, one fixed `almanac/` source tree, and one registry row. There is no custom-root migration logic for future agents to preserve and no parent-directory search that can silently choose the wrong repo [@live-agreement].

Future worktree support should extend this area through repository affiliation rather than by weakening exact root selection. [Repository Affiliation Belongs In Repository Service](../../decisions/repository-affiliation-belongs-in-repository-service) records that proposed seam: temporary checkouts should map back to one registered repository through the repository service, while exact registered roots remain the canonical product identity [@affiliation-decision].

For the product decision behind the fixed root, see [Only almanac root](../../decisions/only-almanac-root). For how lifecycle workflows use repository selection before writing pages, see [Lifecycle workflows](../lifecycle/workflows). For the runtime files associated with selected repositories, see [Local state layout](../../reference/local-state-layout).

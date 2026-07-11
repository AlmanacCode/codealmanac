---
title: Local Repo Wiki
topics: [concepts, wiki]
sources:
  - id: repo-readme
    type: file
    path: README.md
    note: Product overview, init output, runtime state, and daily read commands.
  - id: kernel-prompt
    type: file
    path: src/codealmanac/agents/build/instructions.md
    note: Base rules given to wiki-writing agents.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Current local-only Python product decisions.
---

# Local Repo Wiki

A local repo wiki is the CodeAlmanac knowledge base committed with a single repository. In this codebase, it means the `almanac/` directory: nested Markdown pages, `topics.yaml`, and folder `README.md` landing pages that explain durable project knowledge for future agents [@repo-readme] [@kernel-prompt]. It is local because the Python rewrite does not depend on hosted storage, cloud upload, or remote capture in v1 [@live-agreement].

The concept matters because it separates two kinds of state. Authored knowledge belongs in the repo under `almanac/`; derived runtime state belongs outside the repo under `~/.codealmanac/` [@repo-readme] [@live-agreement]. That boundary keeps the wiki reviewable in Git while still allowing local indexes, run ledgers, and automation state to be rebuilt or updated by tools.

## Authored Source

The committed wiki source is ordinary Markdown. Page identity comes from the path under `almanac/` without `.md`, and `README.md` is the landing page for its folder [@kernel-prompt]. A page under `almanac/concepts/local-repo-wiki.md` therefore has the slug `concepts/local-repo-wiki`.

This path-based identity is why the wiki uses normal Markdown links instead of double-bracket links. File evidence goes in structured `sources:` frontmatter, not in a retired file-list field or in page identity metadata [@kernel-prompt]. For the exact route rules, see [Page identity](../architecture/wiki/page-identity) and [Frontmatter and sources](../reference/page-format/frontmatter-and-sources).

## Derived Local State

Read commands can build and refresh derived state, but that state is not the wiki source. The public README names `~/.codealmanac/codealmanac.db` and per-repository `index.db` files as runtime state for repositories, runs, events, worker locks, sync state, and indexes [@repo-readme].

This means search and validation can be fast without making SQLite files part of the authored wiki. If an index is stale, the tool can refresh it from committed Markdown. If a Markdown page is wrong, the fix belongs in `almanac/`.

## What It Is Not

A local repo wiki is not a scratchpad, transcript archive, or hidden runtime folder. The kernel prompt tells agents to write pages only when the change preserves durable knowledge a future agent would otherwise have to rediscover [@kernel-prompt]. It also tells them not to preserve unresolved intake work, routine activity logs, or raw inventories.

The active Python agreement also removes older product shapes from the target design: no `docs/almanac/`, no `.almanac/`, no custom roots, and no hosted workflow surface for this version [@live-agreement]. The local repo wiki is the one committed tree, and runtime systems orbit around it.

## Related Pages

The architecture details live in [Page identity](../architecture/wiki/page-identity). The product decision behind the local-only shape lives in [Local-only Python product](../decisions/local-only-python-product). The exact page metadata contract lives in [Frontmatter and sources](../reference/page-format/frontmatter-and-sources).

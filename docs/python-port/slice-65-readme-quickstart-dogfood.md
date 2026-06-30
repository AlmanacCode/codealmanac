# Slice 65 - README Quickstart Dogfood

Date: 2026-06-30

## Scope

Make the README quickstart executable against a fresh starter wiki.

## Finding

The README quickstart ran:

```bash
codealmanac init
codealmanac search "auth"
codealmanac show getting-started
codealmanac serve
```

Live temp-repo dogfood showed that `search "auth"` returns `# 0 results`
immediately after `init`, because the starter wiki only contains
`getting-started`.

## Decision

The quickstart now uses:

```bash
codealmanac search "getting"
```

This makes the first search command return `getting-started` in the initialized
starter wiki. The later daily-use examples can still use domain-like queries
such as `auth` or `checkout timeout` because those are illustrative examples
after a wiki has real pages.

## Guard

`tests/test_public_contract.py` now checks that the README quickstart uses
`search "getting"` and does not use `search "auth"`.

## Cosmic Python Note

Chapter 4's Service Layer chapter stresses testing use cases at the service
boundary instead of trusting lower-level pieces in isolation. This slice treats
the README quickstart as a public use case: fresh init, search, show. The
correct proof is the end-to-end command path returning the starter page.

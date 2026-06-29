# Slice 60 - Serve Browser Proof

Date: 2026-06-29

## Purpose

Prove the current local `serve` viewer in a real browser before public release.

## Scope

- Start `codealmanac serve` against a realistic temp wiki.
- Verify overview, page, topic, search, and file-reference routes.
- Verify desktop and mobile viewports have no horizontal overflow.
- Use browser-harness through an isolated Chrome profile.
- Patch only issues exposed by the browser dogfood.

## Dogfood Shape

The dogfood used:

- temp root: `/tmp/codealmanac-serve-slice60-Dxi7UN`
- temp home: `/tmp/codealmanac-serve-slice60-Dxi7UN/home`
- temp repo: `/tmp/codealmanac-serve-slice60-Dxi7UN/repo`
- server URL: `http://127.0.0.1:49260`
- isolated Chrome DevTools endpoint: `http://127.0.0.1:9224`

The temp wiki contained:

- `auth-flow.md`, with topics `auth` and `concepts`
- `billing-boundary.md`, with topics `billing` and `concepts`
- file refs to `src/auth/session.py`, `src/auth/`, and `docs/billing.md`
- a page link from `auth-flow` to `billing-boundary`

The first temp `init` command accidentally used the default registry because
`HOME` was not pinned. The accidental `serve-browser-dogfood` entry was removed
with `codealmanac list --drop serve-browser-dogfood --json` before the browser
proof continued. The final build, health, server, and browser checks used the
temp home.

## Preflight

The temp wiki passed:

```text
codealmanac build /tmp/codealmanac-serve-slice60-Dxi7UN/repo
codealmanac health --json
codealmanac search auth
```

Health reported no orphans, dead refs, broken links, broken cross-wiki links,
empty topics, or empty pages. `search auth` returned `auth-flow` and
`billing-boundary`.

## Browser-Harness Checks

Default browser-harness could not attach to the default Chrome daemon:

```text
[FAIL] daemon alive
[FAIL] active browser connections - 0
```

The pass used an isolated Chrome profile instead:

```text
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9224 \
  --user-data-dir=/tmp/codealmanac-serve-slice60-chrome \
  --no-first-run \
  --no-default-browser-check \
  about:blank
```

Then:

```text
BU_CDP_URL=http://127.0.0.1:9224 browser-harness
```

The browser route assertions covered:

| Route | Assertion |
|---|---|
| `/` | overview rendered `Getting Started`, 3 pages, and 3 topics |
| `#/page/auth-flow` | page rendered `Auth Flow` and file refs |
| `#/topic/auth` | topic rendered `Auth` and listed `Auth Flow` |
| `#/search/auth` | search rendered `Search: auth`, preserved input `auth`, and returned `Auth Flow` plus `Billing Boundary` |
| `#/file/src/auth/session.py` | file route rendered `src/auth/session.py` and listed `Auth Flow` |
| mobile `390x844` `#/page/auth-flow` | rendered page content and file refs with no horizontal overflow |

Every checked route had:

```text
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

The mobile screenshot showed the compact rail, fitted search form, readable
page body, inline file refs, and a visible related-page link.

## Result

No code or CSS patch was needed. The current served viewer satisfies the
browser portion of the public-release gate for the local wiki routes listed in
`public-release-readiness.md`.

The remaining public-release gate is final wheel/sdist package rehearsal from
non-editable installs.

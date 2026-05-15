# Releasing codealmanac

How releases are cut for the `codealmanac` npm package. Local, manual, and
opinionated — the same pattern the OpenAlmanac MCP package uses.

## How to cut a release

From a clean checkout of `main` on the maintainer's machine:

```bash
cd ~/Desktop/Projects/codealmanac
git pull
npm test                         # must pass
npm run build                    # must succeed
npm pack --dry-run               # sanity: tarball contains only expected files
npm version patch                # or: minor | major — commits + tags
git push && git push --tags
npm publish --access public
npm view codealmanac version     # confirm the new version is live
```

The `publishcodealmanac` Claude skill wraps these steps. Prefer invoking
the skill over running the commands by hand; skill keeps the checks uniform.

## Why local and not CI

Publishing runs from the maintainer's machine using the npm auth token in
`~/.npmrc`. No GitHub Secret, no rotating token, no CI publish workflow.

- Matches the existing `publishmcp` flow for the OpenAlmanac MCP package.
- npm's granular tokens max out at 90 days for read-write — local auth via
  a classic automation token in `~/.npmrc` avoids the rotation treadmill.
- One less moving piece.

`.github/workflows/publish.yml` exists but is disabled (`workflow_dispatch`
only, with a hard-fail step). It's kept as a reference in case we want CI
provenance attestation later — that's the main thing local publish gives up.
If we flip to CI publish, the path is: restore the tag trigger, add a
`NPM_TOKEN` repo secret, drop the fail-stop step. History at commit `196d423`.

## Versioning policy

Semver, with pre-1.0 specifics:

- **Pre-1.0 breaking changes** bump minor: `0.1.x` → `0.2.0`.
- **Pre-1.0 features and fixes** bump patch: `0.1.0` → `0.1.1`.
- **Cut 1.0** when the CLI surface is stable and we've dogfooded it on real
  repos (not just fixture tests).
- **First release is `v0.1.0`**, cut once slice 5 (capture + hook) lands.

Prereleases (`0.1.0-rc.1`) are allowed but reserved for genuine release
candidates — not the default flow.

## Pre-release checklist

Before running `npm version`:

- [ ] All tests pass on `main` (`npm test`)
- [ ] `npm run build` succeeds cleanly
- [ ] `npm pack --dry-run` shows only: `dist/`, `prompts/`, `README.md`,
      `LICENSE.md`, `package.json`. No source, no tests, no `.git`, no
      `node_modules`.
- [ ] `README.md` describes the current feature set accurately — not
      aspirational. Users read this on npmjs.com.
- [ ] `CHANGELOG.md` updated with the release notes.
      TODO: add `CHANGELOG.md` once we have multi-release history.

## npm auth

The maintainer's `~/.npmrc` holds a classic automation token scoped to the
maintainer's npm user. That user has publish rights on the unscoped
`codealmanac` package (claimed on first publish — whoever publishes `v0.1.0`
claims it).

If the token ever expires or the maintainer changes, regenerate at
https://www.npmjs.com/settings/~/tokens ("Generate New Token" → "Classic
Token" → "Automation"), and replace the value in `~/.npmrc`:

```
//registry.npmjs.org/:_authToken=<token>
```

## Unpublishing

Don't, if you can avoid it. npm's rules:

- `npm unpublish codealmanac@x.y.z` only works within **72 hours** of publish.
- After 72 hours, use `npm deprecate codealmanac@x.y.z "reason"` instead.
  The version stays installable but warns on install.
- Never reuse a version number — once published (even if unpublished),
  that exact `name@version` is burned forever.

If a release is broken, fix forward: publish a new patch that supersedes
the broken one. Don't try to erase history.

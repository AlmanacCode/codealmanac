# Releasing codealmanac

How releases are cut for the `codealmanac` npm package. Tag-driven, automated,
opinionated.

## How to cut a release

1. Ensure `main` is green — CI has passed on the latest commit.
2. Bump the version. Use npm's built-in versioner, which updates `package.json`,
   creates a commit, and tags it:
   ```bash
   npm version patch   # or: minor | major
   ```
3. Push the commit and the tag:
   ```bash
   git push && git push --tags
   ```
4. GitHub Actions picks up the tag (`v*`), runs the build + typecheck + tests,
   then publishes to npm with provenance.
5. Optional: create a GitHub Release from the tag with human-readable release
   notes.

That's it. No manual `npm publish` — if you find yourself running it locally,
something's wrong with the workflow, not the process.

## Versioning policy

We follow semver, with these pre-1.0 specifics:

- **Pre-1.0 breaking changes** bump minor: `0.1.x` → `0.2.0`.
- **Pre-1.0 features and fixes** bump patch: `0.1.0` → `0.1.1`.
- **Cut 1.0** when the CLI/API surface is stable and we've dogfooded it on real
  repos (not just the fixture tests).
- **First release is `v0.1.0`**, cut once slice 5 (capture + hook) lands.

Prereleases (`0.1.0-rc.1`, etc.) are allowed but not the default flow — only
reach for them when a release is genuinely in review, not as a habit.

## Required setup (one-time)

Before the first publish, an admin must add the `NPM_TOKEN` repo secret:

- **Where:** https://github.com/AlmanacCode/codealmanac/settings/secrets/actions
- **What:** an npm **automation** token (not a personal token) with publish
  rights for the `codealmanac` package under the `AlmanacCode` org.
- **Name:** `NPM_TOKEN` (exact — the workflow references `secrets.NPM_TOKEN`).

Automation tokens bypass 2FA for CI, which is required because the workflow
has no way to satisfy an OTP prompt.

## Pre-release checklist

Before pushing the tag, verify locally:

- [ ] All tests pass on `main` (`npm test`).
- [ ] `npm pack --dry-run` shows only expected files: `dist/`, `prompts/`,
      `README.md`, `LICENSE`, `package.json`. No source, no tests, no
      `.git`, no `node_modules`.
- [ ] `README.md` describes the current feature set accurately — not
      aspirational. Users will read this on npmjs.com.
- [ ] `CHANGELOG.md` updated with the release notes.
      TODO: add `CHANGELOG.md` once we have multi-release history to summarize.

## Provenance

The workflow publishes with `npm publish --provenance`, which attests via
Sigstore that this exact tarball was built by this exact workflow on this
exact commit. This requires `id-token: write` in the workflow's `permissions`
block (already set in `.github/workflows/publish.yml`).

Provenance is verified automatically by `npm install` when present, and shows
up as a green checkmark on the package page.

## Unpublishing

Don't, if you can avoid it. npm's rules:

- `npm unpublish codealmanac@x.y.z` only works within **72 hours** of publish.
- After 72 hours, use `npm deprecate codealmanac@x.y.z "reason"` instead. This
  leaves the version installable but warns anyone who installs it.
- Never reuse a version number — once published (even if unpublished), that
  exact `name@version` is burned forever.

If a release is broken, the fix is to publish a new patch version that
supersedes it, not to try to erase history.

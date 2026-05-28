---
title: NPM Package Surface
summary: The published `codealmanac` package surface is controlled by `package.json`, and licensing changes must keep npm metadata, tarball contents, and README text in sync.
topics: [decisions]
files:
  - package.json
  - package-lock.json
  - README.md
  - LICENSE
sources:
  - commit bf386b4f7804e0d72568bb19546f17d5f879b1e3
  - /Users/kushagrachitkara/.codex/sessions/2026/05/20/rollout-2026-05-20T00-04-39-019e4433-6704-7e81-a624-e4355de08a72.jsonl
verified: 2026-05-20
---

# NPM Package Surface

The published `codealmanac` package is defined by `[[./package.json]]`, not just by the repo tree. Changes to licensing therefore have two user-visible surfaces: package metadata and the tarball contents that `npm` distributes.

## Current license state

Commit `bf386b4f7804e0d72568bb19546f17d5f879b1e3` switched the package from `PolyForm-Noncommercial-1.0.0` to `Apache-2.0`. The current root metadata now reports `Apache-2.0` in `[[./package.json]]`, mirrors that value in the root package entry inside `[[./package-lock.json]]`, and points `[[./README.md]]` at Apache 2.0 in both the badge row and the License section. `[[./LICENSE]]` now contains the full Apache License 2.0 text.

The same change removed the old commercial-license companion document from the published surface. Before that commit, the `files` array in `[[./package.json]]` shipped both `LICENSE` and `COMMERCIAL.md`. The package now ships `LICENSE` only.

## Sync surface

When licensing changes again, future agents should treat these files as one review unit:

- `[[./LICENSE]]` for the authoritative license text
- `[[./package.json]]` for the npm `license` field and published `files` list
- `[[./package-lock.json]]` for the root package license mirror
- `[[./README.md]]` for the badge row and human-readable License section

Changing only one of those surfaces leaves the repo internally inconsistent. The package can otherwise claim one license in metadata, describe another in the README, or keep shipping stale auxiliary legal documents.

## Verification

`npm pack --dry-run` is the direct check for this surface. It reports the exact tarball contents that would be published. On 2026-05-20, a dry run for `codealmanac@0.2.23` showed `LICENSE` and `README.md` in the tarball and did not include `COMMERCIAL.md`.

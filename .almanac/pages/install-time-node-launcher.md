---
title: Install-Time Node Launcher
summary: Installed package bins run through `dist/launcher.js`, which records and reuses the installing Node executable so `better-sqlite3` keeps loading after shell or Node-manager changes.
topics: [cli, systems, storage]
files:
  - package.json
  - scripts/postinstall.cjs
  - bin/install-launchers.ts
  - bin/launcher.ts
  - src/install/launcher-runtime.ts
  - src/abi-guard.ts
  - src/cli.ts
  - src/install/global.ts
  - test/launcher-runtime.test.ts
  - test/global-bootstrap.test.ts
  - test/cli.test.ts
  - tsup.config.ts
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/13/rollout-2026-05-13T13-46-05-019e2316-ec37-75a1-9e29-c1b5edb40354.jsonl
verified: 2026-05-13
status: active
---

# Install-Time Node Launcher

Installed `codealmanac`, `almanac`, and `alm` bins now point at `dist/launcher.js` instead of `dist/codealmanac.js`. The launcher exists to keep the CLI on the same Node executable that installed the package, because [[sqlite-indexer]] still depends on `better-sqlite3` and that native binding is tied to the installing runtime's Node ABI.

## Install contract

`scripts/postinstall.cjs` runs `dist/install-launchers.js` when a built package is installed. `bin/install-launchers.ts` writes `install-runtime.json` at the package root with three facts from the installing process:

- `nodePath`
- `nodeVersion`
- `nodeAbi`

The runtime file is created at install time, not shipped in the tarball. `package.json` publishes `dist/` and `scripts/`, and `.gitignore` excludes `install-runtime.json` from the repo checkout.

## Invocation contract

`bin/launcher.ts` reads `install-runtime.json` synchronously before loading the real CLI graph. When the recorded executable still exists, the launcher spawns `dist/codealmanac.js` with that exact `nodePath` and forwards argv plus stdio unchanged.

The launcher also preserves which bin name the user invoked. It sets `CODEALMANAC_INVOKED_AS` to the basename of `process.argv[1]`, and `src/cli.ts` uses that env var before falling back to `basename(argv[1])`. That preserves the behavioral split between bare `codealmanac` bootstrap mode and bare `almanac` setup mode even though all published bins now point at the same launcher file.

## Failure modes

If `install-runtime.json` is missing or unreadable, the launcher falls back to `process.execPath`. That keeps source checkouts and unusual install layouts runnable, but it also means the old ABI-mismatch behavior can still reappear outside the normal published-install path.

If the recorded `nodePath` no longer exists, the launcher exits before importing the CLI and prints a reinstall command:

```bash
npm install -g codealmanac@latest
```

`src/abi-guard.ts` remains the second line of defense for direct entrypoint calls such as `node dist/codealmanac.js ...`. When the current runtime does not match the installed `better-sqlite3` binary, the guard still prints the local rebuild command and now also shows the mismatch between the running Node and the install-time Node recorded in `install-runtime.json`.

## Relationship to setup bootstrap

`src/install/global.ts` still treats bare `codealmanac` as the npm bootstrap surface. When the current package root is not the durable global install, it runs `npm i -g codealmanac@latest` if needed and reruns setup from the global package's `dist/launcher.js`, not from `dist/codealmanac.js`. That keeps the post-bootstrap setup flow on the same pinned-runtime path as later interactive CLI invocations.

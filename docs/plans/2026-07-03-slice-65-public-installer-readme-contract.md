# Slice 65: Public Installer And README Contract

Status: verified locally; deploy pending.

## Intent

Make the public install path match the verified launch product.

The current production CLI path works from a fresh PyPI install, but the local
machine still has stale `codealmanac` binaries ahead of the PyPI tool on `PATH`.
The README is also mid-rewrite: it points at launch concepts, but it no longer
matches the executable public-contract tests and it does not yet expose the
preferred curl install path recorded in `docs/codealmanac-launch/decisions.md`.

## Scope

- Add a small POSIX installer script source in `scripts/install.sh`.
- Serve the same installer from hosted at `/install.sh`.
- Update `README.md` so the first install line is:
  `curl -fsSL https://www.codealmanac.com/install.sh | sh`.
- Keep `uv tool install --python 3.12 codealmanac` as the explicit manual path.
- Preserve the old README's banner, product voice, and concrete repo-wiki
  language while updating commands to the cloud-first/local-explicit launch.
- Update public-contract tests to protect the launch README rather than the
  stale pre-Slice-65 wording.
- Add hosted route/static tests for the public installer.

## Out Of Scope

- Deleting local stale binaries from Rohan's machine. The installer detects PATH
  shadowing and tells the user what to fix, but it does not remove old npm or
  editable installs.
- Changing package auto-update behavior.
- Moving capture credentials to WorkOS API Keys.
- Changing local trigger execution or hosted worker delivery.

## Architecture Shape

```text
README quickstart
  -> curl https://www.codealmanac.com/install.sh | sh
      -> install uv if missing using Astral's official installer
      -> uv tool install --python 3.12 --upgrade --force codealmanac
      -> warn when another codealmanac shadows uv's tool bin
  -> codealmanac setup
      -> cloud login + agent instructions
  -> codealmanac init / search / show
      -> local wiki path
```

This is documentation/onboarding machinery, not the product engine. The CLI and
services remain the source of product behavior.

## Read Before Coding

- `MANUAL.md`: feature work should reshape the public seam, not bolt on a
  workaround.
- `docs/codealmanac-launch/decisions.md`: README should keep the old feel; curl
  should be the preferred install UX.
- `docs/codealmanac-launch/cli-contract.md`: root setup is cloud setup; local
  setup is under `local`.
- `docs/reference/cosmic-python/chapter_04_service_layer.md`: routes and CLI
  edges should talk to service entrypoints rather than owning workflow logic.
- `docs/reference/cosmic-python/chapter_10_commands.md`: command-like public
  actions should name user intent and fail noisily.
- Vercel Next.js skill: use static `public/` for a public file instead of a
  route handler when no dynamic behavior is needed.

## Verification

- `sh -n scripts/install.sh` passed.
- `sh -n frontend/public/install.sh` passed in hosted.
- `uv run pytest tests/test_public_contract.py -q` passed (`26 passed`).
- `uv run pytest -q` passed (`501 passed`).
- `uv run ruff check .` passed.
- hosted `npm run test:routes` passed (`28 passed`).
- hosted `npm run test:frontend` passed (`52 passed`).
- hosted `npm run lint` passed.
- hosted `npm run build` passed.
- `scripts/install.sh` and hosted `frontend/public/install.sh` are
  byte-for-byte identical.
- Local smoke with temp `HOME`, `UV_TOOL_DIR`, and `UV_TOOL_BIN_DIR` installed
  `codealmanac==0.1.2` and correctly warned that the current shell resolves
  `codealmanac` to the stale Node binary at
  `/Users/rohan/.nvm/versions/node/v21.7.3/bin/codealmanac`.
- `git diff --check` in both repos is still pending.
- Production smoke after deploy is still pending:
  `curl -fsSL https://www.codealmanac.com/install.sh | sed -n '1,80p'`

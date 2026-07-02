# Slice 48: WorkOS Library Auth Boundary

## Goal

Align the hosted auth edge with the new launch steering rule: use trusted
provider libraries and documented flows instead of hand-rolled parallel paths.

This slice should make the current WorkOS/AuthKit boundary explicit in code and
tests:

- Next.js owns the browser session through `@workos-inc/authkit-nextjs`.
- FastAPI receives an AuthKit access token from the Next server layer.
- FastAPI parses bearer auth through FastAPI's `HTTPBearer`, not custom header
  string parsing.
- FastAPI validates the access token using the WorkOS JWKS URL and PyJWT,
  because WorkOS' session docs say API access tokens are JWTs validated with a
  JWT library.
- The WorkOS Python sealed-session helper is not used for this boundary because
  it is for direct `wos_session` cookie sessions, while this app's browser
  cookie is owned by the Next AuthKit SDK.

## Product Contract

- Do not change the user-visible login, setup, or dashboard flow.
- Do not add another auth system.
- Do not move browser sessions from Next.js to FastAPI in this slice.
- Do not remove hosted CLI/capture tokens; those are narrow product machine
  credentials layered after WorkOS identity.
- Record any provider gap explicitly instead of hiding it behind custom code.

## Architecture Wireframe

```python
security = HTTPBearer(auto_error=False)

def bearer_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> str:
    if credentials is None:
        raise NotAuthenticated("Missing bearer token")
    return credentials.credentials

claims = workos_access_tokens.verify(token)
user = users_store.get(claims.workos_user_id)
```

The only custom code left at the auth edge should be product mapping:

```python
WorkOS `sub` -> CodeAlmanac `workos_user_id`
missing linked GitHub user -> not_authenticated
capture token -> capture-only endpoints
CLI token -> CLI-only endpoints
```

## Hosted Files

- `backend/src/almanac/server/deps.py`
- `backend/src/almanac/integrations/workos/client.py`
- `backend/tests/test_identity_auth_contract.py`
- `backend/tests/test_api_error_contract.py`
- `backend/tests/test_architecture_contract.py`
- `frontend/tests/routes.test.mjs`

## Verification

Focused:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_identity_auth_contract.py tests/test_api_error_contract.py tests/test_architecture_contract.py -q
uv run ruff check .

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:routes
```

Before commit:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest -q
uv run python -m compileall src modal_app -q

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:routes
npm run lint
npm run build

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence
git diff --check
```

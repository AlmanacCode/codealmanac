# Slice 57: AuthKit Sign-In Hardening

Date: 2026-07-02.

## Problem

Production sign-in must feel like one simple GitHub login. The current hosted
frontend can start AuthKit from protected-route redirects such as `/dashboard`
and `/setup`, and the public landing links directly to those protected routes.
That makes the first auth hop depend on how Next/WorkOS sees the request. Recent
production logs showed `/auth/callback` failing with:

```text
Sign-in session could not be verified. Please try signing in again.
```

Older logs also showed missing GitHub OAuth tokens. For launch, email/password,
magic link, generic SSO, and email verification are not supported user paths.

## Contract

- `/login` is the product login page.
- `/sign-in` is the only route that starts WorkOS AuthKit.
- Public CTAs link to `/login`, not directly to protected dashboard/setup pages.
- Protected page requests redirect to `/login?next=...`, not directly to
  WorkOS.
- The login page renders one GitHub CTA using a normal anchor to `/sign-in`.
- Auth callback errors return to `/login` with readable GitHub-only errors.
- If WorkOS returns no GitHub OAuth tokens, the callback treats it as an
  unsupported auth method.

## Implementation

Hosted frontend:

- update `frontend/src/proxy.ts`
- update `frontend/src/app/login/page.tsx`
- update `frontend/src/app/auth/callback/route.ts`
- update `frontend/src/components/landing/SiteNav.tsx`
- update `frontend/src/components/landing/Landing.tsx`
- update `frontend/tests/routes.test.mjs`

Launch docs:

- update progress, worklog, verification matrix, and next-agent brief after
  verification.

## Verification

- `npm run test:routes`
- `npm run test:frontend`
- `npm run lint`
- `npm run build`
- browser smoke for `/login` and unauthenticated `/setup`
- production smoke after one batched deploy

## Out of Scope

- WorkOS dashboard authentication-method changes. If AuthKit Hosted UI still
  exposes non-GitHub methods after this code change, that is a dashboard config
  task.
- Rate limiting.
- Local signed-in backend walkthrough; `codealmanac/dev_personal` is still
  missing `GITHUB_TOKEN_ENCRYPTION_KEYS`.

## Result

Hosted commits:

- `2b68292` — harden the AuthKit sign-in entry
- `041deb8` — default sign-in to setup

Production:

- deployed to `https://codealmanac-hosted-jaxnxk6oq-thealmanac.vercel.app`
- aliased to `https://www.codealmanac.com`

Verification:

- `npm run test:routes` -> 27 passed
- `npm run test:frontend` -> 52 passed
- `npm run lint`
- `npm run build`
- `git diff --check`
- production `/setup?smoke=auth57b` -> `307 /login?next=%2Fsetup%3Fsmoke%3Dauth57b`
- production `/sign-in` -> WorkOS redirect with `wos-auth-verifier-*` cookie
- browser-harness `/login` -> `Continue with GitHub`, no inputs,
  `/sign-in?returnTo=%2Fsetup`
- Vercel production error logs -> no recent errors

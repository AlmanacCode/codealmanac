---
title: Hosted Deployment Environment
summary: Almanac for GitHub currently uses the `usealmanac` repository and a `codealmanac` provider namespace across Vercel, Render, Supabase, Modal, and Doppler.
topics: [product-positioning, stack]
sources:
  - id: external-providers-doc
    type: manual
    note: Records the current provider roles, resource names, setup status, backend environment variables, and deployment conventions from /Users/rohan/Desktop/Projects/usealmanac/docs/external-providers.md.
  - id: provider-setup-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: Records the 2026-06-03 setup run that created or verified hosted provider resources, created the Render backend service after private-repository access was fixed, found that the first native Render deploy failed because the checked-out main commit did not contain backend/, replaced the native service with a Docker service after Render CLI would not convert it reliably, renamed the working service while keeping the generated Docker hostname, verified the Docker backend with production Doppler settings, registered the Almanac Bot GitHub App, stored the GitHub App secret names in Doppler, and verified production health recognized the GitHub App config.
status: active
verified: 2026-06-03
---

The hosted Almanac for GitHub environment is split between the `usealmanac` application repository and a `codealmanac` provider namespace. `usealmanac` is the code home for the hosted frontend, FastAPI backend, Modal worker scaffold, provider docs, and local deployment configuration, while `codealmanac` is the shared resource name used for Supabase, Doppler, Modal secrets, and the Render backend service [@external-providers-doc].

## Provider Roles

Vercel hosts the Next frontend from the existing `usealmanac` project. Render hosts the Python FastAPI backend through the working Docker service `codealmanac-backend`. Supabase is the hosted database and project state store. Modal runs async worker and sandbox jobs under the hosted worker path. Doppler stores shared deployment and local-development secrets. The GitHub App owns webhooks, installation authentication, checks, pull requests, and repository writes [@external-providers-doc] [@provider-setup-session].

The deployment boundary matches [[github-native-wiki-maintenance]]: hosted infrastructure can receive GitHub events, run jobs, and publish Almanac-root changes, but durable project memory still lands as reviewed markdown in Git. Provider state is deployment/configuration state, not a product table inside the application database; the `usealmanac` provider doc explicitly rejects an `external_app_setup_status` table for v1 [@external-providers-doc].

## Current Resource State

As of 2026-06-03, Vercel is linked locally to `thealmanac/usealmanac`, and the production frontend URL is `https://usealmanac.com` [@provider-setup-session].

Supabase project `codealmanac` exists in `us-east-1` with ref `amlownbvhsmnuhqofknb`, and the local `supabase/` directory in `usealmanac` is linked to that project [@external-providers-doc]. The setup run verified the project status as `ACTIVE_HEALTHY` [@provider-setup-session].

Doppler project `codealmanac` exists with `dev`, `dev_personal`, `stg`, and `prd` configs. The configs currently hold the Supabase URL, database URL, anon key, service-role key, generated database password, and non-secret deployment defaults [@external-providers-doc].

Modal secret `codealmanac-doppler-prd` exists and contains only Doppler bootstrap values for `codealmanac/prd`: `DOPPLER_TOKEN`, `DOPPLER_PROJECT`, and `DOPPLER_CONFIG` [@provider-setup-session]. The Modal worker image installs the Doppler CLI, and `npm run modal:smoke` passed after the secret was attached [@provider-setup-session].

Render workspace `Almanac` is selected because it contains the active `openalmanac` backend. The old native Python service was the first `codealmanac-backend` service, had id `srv-d8g8f36q1p3s739aut80`, root directory `backend`, and URL `https://codealmanac-backend.onrender.com`, but it is not the working backend deployment [@provider-setup-session].

The working backend deployment is Render Docker service `codealmanac-backend` with id `srv-d8g8nb37uimc739vnnsg` and generated URL `https://codealmanac-backend-docker.onrender.com`. Render kept that hostname after the service was renamed from `codealmanac-backend-docker` to `codealmanac-backend` [@provider-setup-session]. The verified deploy after repo commit `dd48f5a` returned `status: "ok"`, `environment: "production"`, and provider flags with `postgres`, `supabase`, `modal`, `doppler`, `frontend`, and `backend` true while `github_app` remained false before GitHub App credentials were configured [@provider-setup-session].

Render CLI did not reliably convert the native Python service into a Docker service. The deployment record therefore treats service id `srv-d8g8nb37uimc739vnnsg` as the active backend and treats the old native service id `srv-d8g8f36q1p3s739aut80` as stale history unless a future operator removes it through the Render dashboard or a more reliable API path [@provider-setup-session].

## Secret Bootstrap Rule

Render and Modal should receive only Doppler bootstrap environment when possible: `DOPPLER_TOKEN`, `DOPPLER_PROJECT=codealmanac`, and `DOPPLER_CONFIG=prd` [@external-providers-doc].

The Render backend should run as a Docker service, not as Render's native Python runtime. The root `Dockerfile` in `usealmanac` exists because the Render CLI-created Docker service looked for `./Dockerfile` and did not expose a Dockerfile-path flag during the setup run [@provider-setup-session]. The backend image installs the Doppler CLI and starts with `doppler run -- uv run uvicorn ...`, matching the active OpenAlmanac backend pattern [@provider-setup-session]. That keeps secret loading in the deployment wrapper and keeps Python application code limited to reading environment variables through `pydantic-settings` [@external-providers-doc].

The rejected alternative was app-level Doppler HTTP API hydration at Python startup. That path would let Render's native Python runtime boot without installing the Doppler CLI, but it creates custom secret-loading code and diverges from the existing OpenAlmanac backend convention [@provider-setup-session].

Local personal development should use `codealmanac/dev_personal`. Deployment should use `codealmanac/prd`. The configs may hold similar values early in the project, but keeping the environment-specific config split is the current operational convention [@external-providers-doc].

## Backend Environment Contract

The hosted backend reads environment variables directly and does not implicitly load `.env` files. Required groups are app URLs, Supabase/Postgres credentials, GitHub App credentials, Modal settings, and Doppler bootstrap values [@external-providers-doc].

The required GitHub App names are `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`. GitHub App installation tokens are not durable secrets in this model; workers should mint them per job and inject them into the runtime that needs repository access. The 2026-06-03 health endpoint explicitly tolerated missing GitHub App credentials by reporting `github_app: false` while still verifying that the production backend, Doppler, database, Supabase, Modal, frontend, and backend URL wiring were present [@provider-setup-session].

The GitHub App is registered in GitHub as Almanac Bot, owned by `@rohans0509`, with App ID `3955695`, Client ID `Iv23lip5I92lhXZPzAs2`, and Doppler slug value `almanac-bot` [@provider-setup-session]. The downloaded private key file was found at `/Users/rohan/Downloads/almanac-bot.2026-06-03.private-key.pem` during setup and was stored in Doppler without printing its contents [@provider-setup-session].

`GITHUB_WEBHOOK_SECRET` was generated locally and stored in Doppler for `codealmanac/prd`, `codealmanac/dev_personal`, and `codealmanac/dev` during GitHub App setup. The GitHub App metadata and private key were later stored in the same three Doppler configs, and `codealmanac/prd` contained `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`, and `GITHUB_WEBHOOK_SECRET` after setup [@provider-setup-session]. A Render restart was requested for service `srv-d8g8nb37uimc739vnnsg`, and production `/api/health` later reported `github_app: true`; GitHub had already posted to `/api/github/webhook` and received `404` because the webhook route had not been implemented yet [@provider-setup-session].

## Related Pages

[[github-native-wiki-maintenance]] is the product and architecture hub for the hosted GitHub App. [[evidence-bundles]] describes the source-event-to-operation boundary that the hosted worker should feed. [[process-manager-runs]] describes the local run record pattern that informs hosted audit and job visibility.

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
    note: Records the 2026-06-03 setup run that created or verified hosted provider resources, created the Render backend service after private-repository access was fixed, found that the first native Render deploy failed because the checked-out main commit did not contain backend/, replaced the native service with a Docker service after Render CLI would not convert it reliably, renamed the working service while keeping the generated Docker hostname, verified the Docker backend with production Doppler settings, registered the Almanac Bot GitHub App, stored the GitHub App secret names in Doppler, verified production health recognized the GitHub App config, and made the AlmanacCode installation visible for selected repositories.
  - id: webhook-live-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: "Records the first live GitHub webhook backend slice: signed ping delivery accepted by Render, HMAC verification, Supabase persistence in GitHub installation/repository/event tables, Supabase pooler DATABASE_URL correction, and live smoke verification after deploy."
  - id: pr-update-implementation-log
    type: manual
    note: Records the 2026-06-05 hosted PR update loop implementation decisions and verification results on the `usealmanac` dev branch; source path is /Users/rohan/Desktop/Projects/usealmanac-dev/docs/plans/2026-06-04-backend-architecture-refactor-log.md.
  - id: pr-update-live-smoke-runbook
    type: manual
    note: Defines the production-readiness smoke test for the hosted GitHub App PR update loop; source path is /Users/rohan/Desktop/Projects/usealmanac-dev/docs/runbooks/pr-update-live-smoke.md.
  - id: pr-update-production-smoke-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: Records the 2026-06-05 production smoke that retried the Almanac check after the model quota reset, fixed duplicate GitHub webhook delivery processing, redeployed Render at commit 05ead0e, and verified a same-repository Almanac bot commit on PR 12.
  - id: cloud-hook-command
    type: file
    path: src/cli/commands/cloud.ts
    note: Implements the local cloud login, status, and provider hook command surface used to send conversation turns to the hosted backend.
  - id: cloud-capture-hook
    type: file
    path: src/cloud/capture/hooks.ts
    note: Records the start/stop hook contract and uploads completed provider turns through the cloud client path.
  - id: conversation-turn-upload
    type: file
    path: src/cloud/capture/conversation-turn.ts
    note: Builds hosted conversation-turn uploads with repo routing, branch/head metadata, transcript-path hashing, and normalized messages.
  - id: cloud-capture-tests
    type: file
    path: test/cloud-capture.test.ts
    note: Verifies completed hook turns upload to the hosted API and skip repositories that Almanac Cloud does not host.
  - id: modal-conversation-smoke
    type: conversation
    path: /tmp/almanac-conversation-_xrno75p.md
    note: Records the 2026-06-29 synthetic Codex turn used only to force a hosted conversation ingest run through the production Modal path.
status: active
verified: 2026-06-29
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

The app install flow initially showed only `@rohans0509` because the App was still private to the personal account. Making Almanac Bot public allowed installation on `AlmanacCode`, and the setup run verified that the App installation was visible for selected repositories before webhook implementation began [@provider-setup-session].

The first live webhook slice is deployed on Render. `POST /api/github/webhook` verifies `X-Hub-Signature-256`, accepts valid GitHub-style deliveries with `202`, and persists delivery state into `github_installations`, `github_repositories`, and `github_events` in Supabase [@webhook-live-session]. The final live smoke against the deployed backend returned `/api/health` as `200 ok`, accepted a signed `ping` payload, and found the stored `github_events` row for installation `137830832` and sender `rohans0509` [@webhook-live-session].

The database connection string was moved to the Supabase session-pooler host after the first pooler value failed. `DATABASE_URL` for `codealmanac/prd`, `codealmanac/dev_personal`, and `codealmanac/dev` now uses the `aws-1-us-east-1.pooler.supabase.com:5432` Supabase pooler form with `sslmode=require`, matching the live backend's successful SQLAlchemy connection checks [@webhook-live-session].

## PR Update Loop State

The hosted same-repository PR update loop is production-smoked as of 2026-06-05. The implemented backend records durable PR state and run rows, normalizes GitHub PR and check-action triggers, publishes one mutable check-run surface, authorizes actions through GitHub collaborator permissions, invokes Modal, receives Modal completion through an `X-Internal-Secret` route, validates returned Almanac-root bundles in the backend, delivers same-PR updates through the GitHub Git Data API, dispatches delivery through `run.delivery_kind`, and suppresses the bot loop by tracking the delivered Almanac commit SHA [@pr-update-implementation-log] [@pr-update-production-smoke-session].

Repository settings are backend-owned for v1. The settings API is protected by the same internal-secret route pattern until dashboard user auth exists, same-repository behavior is controlled by `ask`, `auto`, or `disabled`, and fork follow-up behavior is disabled because follow-up PR delivery is not implemented yet. `same_pr_branch` is the only implemented delivery kind in v1, and stale fork actions now surface `fork_followup_unavailable` instead of queueing undeliverable runs [@pr-update-implementation-log].

The production smoke followed the live-smoke runbook and used `AlmanacCode/codealmanac#12`. Render deployed commit `05ead0e`, the production health endpoint was green, the Almanac check reached success with the title "Almanac updated", the App committed `.almanac/pages/github-native-wiki-maintenance.md` as bot commit `09e4b706491207e3433cc264d7911839682b2196`, and the production run row reached `succeeded`, `delivered`, `same_pr_branch` with that delivered commit SHA [@pr-update-live-smoke-runbook] [@pr-update-production-smoke-session].

The live smoke found one production-readiness blocker before the successful retry: duplicate GitHub webhook deliveries were recorded idempotently but still processed. The fix made duplicate deliveries stop before trigger handling, added a regression test, and redeployed before the successful smoke. Future webhook work must preserve that boundary because a duplicate `check_run.requested_action` delivery can otherwise queue duplicate Modal runs for the same pull-request head [@pr-update-production-smoke-session].

## Hosted Conversation Capture State

Hosted conversation capture is separate from local quiet-session `almanac sync`. The local CLI installs provider hooks that call `almanac cloud capture-hook --provider <codex|claude> --event UserPromptSubmit|Stop`; the start hook stores an open turn locally, and the stop hook builds one completed `ConversationTurnUpload` before sending it to Almanac Cloud [@cloud-hook-command] [@cloud-capture-hook].

The upload object is deliberately a routed conversation turn, not a wiki update. It carries provider identity, provider session and turn ids, a transcript path hash, first cwd, branch and branch-source metadata, routing status, head SHA, timestamps, and normalized messages. Repo routing comes from the current Git remote and branch when the provider payload does not supply enough information; missing branch information is preserved as `missing_branch` rather than guessed [@conversation-turn-upload] [@cloud-capture-tests].

A synthetic Codex turn on 2026-06-29 was created only to force a hosted conversation ingest run through the production Modal path. It should not be treated as project knowledge beyond the operational fact that production hosted conversation ingest needed, and received, a smoke input shaped like a completed Codex turn [@modal-conversation-smoke].

## Related Pages

[[github-native-wiki-maintenance]] is the product and architecture hub for the hosted GitHub App. [[evidence-bundles]] describes the source-event-to-operation boundary that the hosted worker should feed. [[process-manager-runs]] describes the local run record pattern that informs hosted audit and job visibility.

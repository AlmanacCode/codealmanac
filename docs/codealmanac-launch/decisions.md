# Launch Decisions

Status: active.

## Accepted

- Product language uses **cloud**, not hosted.
- The old `usealmanac` repo will become `codealmanac-hosted`.
- `codealmanac-hosted` depends on `codealmanac`; `codealmanac` must not depend
  on `codealmanac-hosted`.
- Cloud is the default product experience.
- Local remains a real free/dev runtime with parallel architecture where useful.
- Cloud auth uses WorkOS/AuthKit as the long-term identity provider.
- Supabase may remain database/storage, but Supabase Auth is not the long-term
  cloud identity system.
- CodeAlmanac may create a fresh WorkOS application/environment instead of
  reusing the old `../almanac` app directly.
- A new WorkOS project named `codealmanac` exists and is the target for
  CodeAlmanac cloud auth.
- WorkOS uses one production environment for now. Do not design separate
  WorkOS dev/staging/prod environments until that is explicitly reopened.
- Confirmed WorkOS callback targets are
  `https://codealmanac.com/auth/callback` and
  `http://localhost:3000/auth/callback`.
- Canonical wiki content lives in the repository.
- Query DB and control DB are separate.
- Cross-wiki links are sunset for cloud and local.
- Cloud and local share the engine request/result contract.
- Intelligence lives in prompts, not preprocessing pipelines.
- Source material is passed by reference, never by value. Workers receive paths,
  storage refs, ids, and artifact handles; they do not receive copied source
  blobs embedded into request payloads.
- GitHub provider OAuth tokens should be returned by WorkOS and captured in the
  AuthKit callback when present.
- GitHub OAuth scopes stay narrow by default. `user:email` is required for
  sign-in identity; repo read/write operations should use GitHub App
  installation tokens and app permissions instead of broad user OAuth scopes.
- The public CLI is not the worker API.
- Bare `codealmanac` opens the cloud wiki for the current checkout.
- `codealmanac setup` is cloud onboarding.
- `codealmanac local setup` is local maintenance setup.
- Browser onboarding owns product consent and repo policy.
- CLI owns local machine installation, provider probing, and capture hooks.
- Capture consent happens in browser; capture installation happens in CLI.
- Codex/Claude detection is useful and should be non-blocking.
- Maintained branch and delivery mode are one trigger policy row.
- Delivery mode is configured per branch.
- Cloud default delivery mode is commit.
- Local default delivery mode is commit.
- Public launch CLI should not expose `ingest` or `garden`.
- Local public maintenance command is `codealmanac local update`.
- CLI auto-update should happen without asking, using a safe background/next-run
  model.
- Existing Python auto-update libraries must be researched before custom update
  machinery is written.
- The first overnight execution priority is infrastructure and deployment, so
  the renamed cloud product exists on real providers before deeper feature work.
- Provider CLIs/APIs should be used where available for Vercel, Render,
  Supabase, Modal, Doppler, PostHog, Autumn, and GitHub.
- Supabase migrations can be rewritten/collapsed/repaired during this launch
  because there are no external customers yet.
- Public API routes need launch rate limits; frontend throttling is not enough.
- Rate limits should use a low-level API/shared counter backend rather than
  only provider/frontend throttling.
- `codealmanac-hosted` should initially pin `codealmanac` by git SHA.
- Cloud workers must call the model/engine API directly, not the human CLI.
- `codealmanac-hosted` is a literal rename/evolution of `usealmanac`.
- The current `usealmanac` frontend look and feel should be preserved unless a
  deliberate product/design decision changes it.
- Internal frontend structure may be refactored during the rename if it makes
  the hosted architecture cleaner.

## Naming

- `runs` is the cloud execution word.
- `jobs` is the local execution word.
- `capture`, not `agents`, is the user-facing noun for conversation capture.
- `triggers` is the user-facing noun for maintained branch update policy.
- `repo list` replaces the confusing `repo`/`repos` split.

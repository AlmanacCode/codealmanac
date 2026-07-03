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
  `https://www.codealmanac.com/auth/callback` and
  `http://localhost:3000/auth/callback`.
- Launch AuthKit should present GitHub login only. Email/password, magic auth,
  and generic SSO should stay disabled unless explicitly reopened.
- Email verification is not part of launch login. If a user reaches an email
  verification or email/password path, treat it as a WorkOS/AuthKit
  configuration bug because CodeAlmanac requires GitHub OAuth to return GitHub
  provider tokens.
- Canonical wiki content lives in the repository.
- Query DB and control DB are separate.
- Cross-wiki links are sunset for cloud and local.
- Cloud and local share the engine request/result contract.
- Intelligence lives in prompts, not preprocessing pipelines.
- Source material is passed by reference, never by value. Workers receive paths,
  storage refs, ids, and artifact handles; they do not receive copied source
  blobs embedded into request payloads.
- Trusted provider libraries are preferred over hand-rolled implementations.
  When WorkOS/AuthKit, GitHub, Vercel, Render, Supabase, Modal, Doppler,
  PostHog, Autumn, or another trusted public library owns a flow, CodeAlmanac
  should follow the documented library path and avoid parallel product-owned
  paths unless a documented provider gap forces a narrow adapter.
- Concept hierarchy and dependency direction are part of correctness. A slice
  should name which layer owns each concept and should avoid flattening distinct
  concepts such as browser sessions, API bearer tokens, CLI tokens, and capture
  credentials into one vague auth bucket.
- GitHub provider OAuth tokens should be returned by WorkOS and captured in the
  AuthKit callback when present.
- `codealmanac setup` and `codealmanac login` should use WorkOS CLI Auth through
  a thin CodeAlmanac API wrapper. The wrapper exists so the CLI talks only to
  CodeAlmanac product endpoints while the backend delegates device
  authorization, token exchange, and refresh to WorkOS.
- CodeAlmanac should not invent durable human CLI tokens, refresh-token logic, or
  API-key storage when WorkOS provides the primitive. The CLI may store
  WorkOS-issued access and refresh tokens locally, and the backend maps WorkOS
  identity to CodeAlmanac product permissions.
- Do not add a public API-key product surface unless a concrete launch workflow
  needs it. If programmatic credentials are needed for capture, SDK, MCP, or
  automation, prefer WorkOS API Keys or the closest WorkOS machine credential
  primitive behind a CodeAlmanac API wrapper.
- Capture credentials must be WorkOS-backed auth/machine credentials rather than
  a separate long-term CodeAlmanac-owned token system. The capture surface may
  still expose CodeAlmanac-shaped issue/status/revoke endpoints.
- GitHub OAuth scopes stay narrow by default. `user:email` is required for
  sign-in identity; repo read/write operations should use GitHub App
  installation tokens and app permissions instead of broad user OAuth scopes.
- GitHub provider OAuth tokens are encrypted at rest in cloud SQL using
  `cryptography` Fernet/MultiFernet behind the `UsersStore` boundary.
- WorkOS Vault is deferred until CodeAlmanac has a product hierarchy where
  WorkOS organizations clearly own the GitHub accounts/repositories whose
  secrets are stored.
- Legacy plaintext GitHub provider-token columns are invalidated and dropped
  during launch migrations. They must not be renamed into ciphertext columns.
- Do not deploy after every small verified fix. Batch deploys after coherent
  infrastructure/functionality slices, especially when a Supabase migration and
  backend rollout must happen together.
- The public CLI is not the worker API.
- Bare `codealmanac` opens the cloud wiki for the current checkout.
- `codealmanac setup` is cloud onboarding.
- `codealmanac setup` must not install local scheduled automation; local
  automation belongs under the explicit local surface.
- `codealmanac local setup` is local maintenance setup.
- `codealmanac local setup` detects the current GitHub checkout, writes the
  repository and branch trigger policy to the local control DB, and installs
  local Git trigger hooks unless explicitly skipped.
- Browser onboarding owns product consent and repo policy.
- CLI owns local machine installation, provider probing, and capture hooks.
- Capture consent happens in browser; capture installation happens in CLI.
- Codex/Claude detection is useful and should be non-blocking.
- Maintained branch and delivery mode are one trigger policy row.
- Delivery mode is configured per branch.
- Cloud default delivery mode is commit.
- Local default delivery mode is commit.
- Public launch CLI should not expose `ingest` or `garden`.
- Manual `ingest` and `garden` remain available under the hidden
  `codealmanac dev` namespace for maintainers and agents.
- Local public maintenance command is `codealmanac local update`.
- `codealmanac local update` is a foreground manual update for the current
  configured checkout and branch.
- `codealmanac local update` records a `manual` trigger event and then runs the
  same local worker path used by Git hook triggers.
- Manual local update can rerun on the same HEAD because local capture/source
  material can change without a Git commit.
- Manual local update does not start a second job when the same branch already
  has a queued or running local job.
- Local trigger policy commands are repo-scoped to the current configured
  checkout and branch-targeted by argument.
- Local trigger policy commands mutate local control DB branch rows only; they
  do not install hooks, spawn workers, or run updates.
- Local delivery policy changes preserve trigger enabled/disabled state.
- CLI auto-update should happen without asking, using a safe background/next-run
  model.
- Existing Python auto-update libraries must be researched before custom update
  machinery is written.
- The first overnight execution priority is infrastructure and deployment, so
  the renamed cloud product exists on real providers before deeper feature work.
- Provider CLIs/APIs should be used where available for Vercel, Render,
  Supabase, Modal, Doppler, PostHog, Autumn, and GitHub.
- CodeAlmanac PyPI publishing uses PyPI Trusted Publishing through GitHub
  Actions and the official PyPA publish action. Do not add a PyPI token to
  Doppler or GitHub secrets for the standard release path.
- Supabase migrations can be rewritten/collapsed/repaired during this launch
  because there are no external customers yet.
- Rate limits are postponed. They remain necessary before broad public scale,
  but they are not part of the current product-first launch slice.
- `codealmanac-hosted` should initially pin `codealmanac` by git SHA.
- Cloud workers must call the model/engine API directly, not the human CLI.
- `codealmanac-hosted` is a literal rename/evolution of `usealmanac`.
- The current `usealmanac` frontend look and feel should be preserved unless a
  deliberate product/design decision changes it.
- Internal frontend structure may be refactored during the rename if it makes
  the hosted architecture cleaner.
- First-build prompt and manual resources use `init` naming:
  `operations/init.md` and `manual/init.md`.
- Public `codealmanac init` is the agent-backed first-build command.
- Public `codealmanac build` is removed from the launch CLI surface.
- Internal scaffold-only setup uses `app.workflows.init.initialize_workspace`.

## Naming

- `runs` is the cloud execution word.
- `jobs` is the local execution word.
- `capture`, not `agents`, is the user-facing noun for conversation capture.
- `triggers` is the user-facing noun for maintained branch update policy.
- `repo list` replaces the confusing `repo`/`repos` split.

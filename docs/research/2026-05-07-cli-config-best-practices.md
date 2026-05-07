# CLI Configuration, Settings, and Onboarding — Reference

Compiled while redesigning codealmanac's config and setup story. Read this when (1) deciding where config files live, (2) defining override precedence, (3) shaping `almanac doctor` / `setup` / `config` commands, or (4) figuring out how to expose provider+model selection across Claude / Codex / Cursor. The goal is to ground the redesign in what mature CLIs actually do, not in invented patterns. Section 9 ("Recommendations for codealmanac") translates the findings into specific advice for our case.

Sources are linked inline. Where official docs are ambiguous I say so rather than guessing.

---

## 1. The four building blocks every mature CLI has

Across git, kubectl, npm, gh, aws, docker, terraform, stripe, supabase, and aider, the same four-part skeleton recurs:

1. **Tiered config files** with a defined merge/override order (system → user → project, or some subset).
2. **Environment-variable overrides** for everything settable in a file, prefixed with the tool name (`GH_*`, `KUBECONFIG`, `AWS_*`, `TF_*`).
3. **Per-invocation flags** that win over both env and files.
4. **A diagnostics command** (`status`, `doctor`, `--show-origin`) that explains *where a value came from* rather than just what it is.

Tools that skip any of these feel toy. Tools that get all four right (git, kubectl, gh) become muscle memory.

The canonical precedence — also recommended by [clig.dev](https://clig.dev/#configuration) — is:

```
flags  >  env vars  >  project config  >  user config  >  system config  >  built-in defaults
```

Lower-numbered sources override higher-numbered ones. This is the order users expect; deviating from it is almost always a bug they will hit.

---

## 2. The reference implementations

### 2.1 git — the gold standard for tiered config

Git defines four scopes. From `git-config(1)`:

| Scope | Location | Flag | When to use |
|------|----------|------|-------------|
| system | `/etc/gitconfig` (or `$(prefix)/etc/gitconfig`) | `--system` | applies to every user on the machine |
| global | `$XDG_CONFIG_HOME/git/config` then `~/.gitconfig` | `--global` | applies to one user |
| local | `.git/config` (default for writes) | `--local` | applies to one repo |
| worktree | `.git/config.worktree` | `--worktree` | per-worktree override; requires `extensions.worktreeConfig` |

Override order (lowest to highest precedence): system → global → local → worktree → command-line `-c key=value`. Later wins.

The killer feature is **`git config --show-origin`** (and `--show-scope`):

```
$ git config --show-origin --get user.email
file:/Users/rohan/.gitconfig    rohan@example.com
```

Users debugging "why is git doing X?" run this and immediately see whether the value comes from `~/.gitconfig`, the repo's `.git/config`, or a `-c` override. **The lesson: every tiered-config CLI should have an equivalent of `--show-origin`.** Without it, users guess.

`git config --list --show-origin` dumps everything with provenance, in precedence order, so the last value for any key is the effective one.

### 2.2 kubectl — single config, multiple files via `KUBECONFIG`

kubectl uses one logical config (a YAML document with `clusters`, `users`, `contexts`, `current-context`) that can be sourced from multiple files. Precedence ([source: cli-runtime loader](https://github.com/kubernetes/client-go/blob/master/tools/clientcmd/loader.go), summarized in [Ahmet Alp Balkan's "Mastering KUBECONFIG"](https://medium.com/@ahmetb/mastering-kubeconfig-4e447aa32c75)):

1. `--kubeconfig` flag
2. `KUBECONFIG` env var (colon-separated list of files; merged in-memory, first occurrence wins for a given key)
3. `$HOME/.kube/config`

There is **no project-level kubeconfig** by convention; users get per-directory behavior with `direnv` (setting `KUBECONFIG=./kubeconfig`). This is a deliberate choice: kubectl's authors did not want config to follow `cwd` because pasting a `kubectl` command between shells should always do the same thing.

Key concept: `current-context` is a stored selection inside the config file, not a separate setting. `kubectl config use-context X` mutates the file. Reading: `kubectl config current-context`. This **selection-as-data** pattern matters for codealmanac: "which provider is active" can either be a config key (like git's `user.signingkey`) or a separate piece of state (like kubectl's `current-context`). Both work; pick one consciously.

`kubectl config view` flattens and prints the merged result. `--minify` strips out everything not referenced by `current-context`. Functionally equivalent to git's `config --list`.

### 2.3 npm — the cleanest cascade

From [npm docs (npmrc)](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc):

> npm gets its config settings from the command line, environment variables, and `npmrc` files.

Cascade, highest precedence first:

1. command line (`--registry=...`)
2. environment variables (`NPM_CONFIG_REGISTRY=...`, generated automatically by lowercasing key and prefixing `npm_config_`)
3. project `.npmrc` (`/path/to/my/project/.npmrc`)
4. user `~/.npmrc`
5. global `$PREFIX/etc/npmrc`
6. npm built-in `/path/to/npm/npmrc` (shipped with npm itself)

Two things worth stealing:

- **Env-var auto-mapping**: every config key has an automatically-derived env var. Users don't need to memorize a separate list. `cache=...` in `.npmrc` ↔ `NPM_CONFIG_CACHE=...` in shell.
- **A built-in defaults file** (item 6) instead of hardcoded defaults. This is overkill for a small CLI but the principle generalizes: defaults should be *visible somewhere*, not hidden in source.

`npm config list` shows the merged effective config. `npm config list -l` includes defaults. `npm config get <key>` for a single value. `npm config edit` opens `$EDITOR` on the appropriate file (defaulting to user-level).

### 2.4 gh (GitHub CLI) — file + env, with a separated auth store

Configuration lives in `~/.config/gh/config.yml`; authentication state lives separately in `~/.config/gh/hosts.yml`. From the [gh-config manpage](https://cli.github.com/manual/gh_config):

```
$ gh config list
git_protocol=https
editor=
prompt=enabled
pager=
http_unix_socket=
browser=
```

Read/write commands: `gh config get <key>`, `gh config set <key> <value> [--host HOST]`. No `--show-origin` analogue — gh has only one config file, so provenance is trivial.

The split between `config.yml` (preferences) and `hosts.yml` (credentials per host) is deliberate. Auth state has different handling needs (secure storage on macOS Keychain when available, never check into dotfiles, sometimes machine-specific) than user preferences. **codealmanac should treat agent auth state similarly to gh's `hosts.yml`** — it is per-provider, sometimes a token, sometimes a delegation to the provider's own auth — and should not live in the same TOML/JSON as `agent.default = "claude"`.

`gh auth status` ([docs](https://cli.github.com/manual/gh_auth_status)) is the readiness probe: prints active account, host, token scopes, exits non-zero if any host is unhealthy. `gh auth login` runs the OAuth device flow by default and stores credentials in the system keychain via `keyring`. `gh auth switch` flips the active account when multiple are logged in. **This `login` / `status` / `switch` / `logout` quartet is the de facto pattern for CLI auth UX.** Adopt it verbatim.

### 2.5 aws — split between credentials and config, with profiles

`~/.aws/credentials` (sensitive: keys, session tokens) and `~/.aws/config` (region, output format, role assumptions, endpoint overrides). Both files are INI-format with `[default]` and `[profile X]` sections. From [AWS docs](https://docs.aws.amazon.com/cli/v1/userguide/cli-configure-files.html):

> The AWS CLI stores sensitive credential information that you specify with `aws configure` in a local file named `credentials`, in a folder named `.aws` in your home directory. The less sensitive configuration options [...] are stored in a local file named `config`.

Profiles are selected via `--profile foo`, `AWS_PROFILE=foo`, or `[default]`. Each individual setting also has a per-key env var (`AWS_REGION`, `AWS_DEFAULT_OUTPUT`, etc.).

Precedence (effective for credential resolution; full chain has more steps):

1. CLI flags
2. env vars (`AWS_ACCESS_KEY_ID`, etc.)
3. assumed-role chains via `source_profile`
4. profile in `credentials` / `config`
5. EC2 instance metadata service

The profile model is a strong fit for AI agent CLIs because users genuinely have multiple identities (work account, personal account, free-tier vs paid). For codealmanac, "profile" maps cleanly onto "which account is paying for the API call" but is **also entangled with provider selection** in a way AWS doesn't have. Decision below in §9.

### 2.6 Stripe — XDG-native TOML with project profiles

From [Stripe CLI docs](https://docs.stripe.com/cli/login):

> All configurations are stored in `~/.config/stripe/config.toml`, including login credentials. You can use the `XDG_CONFIG_HOME` environment variable to override the path.

```toml
[default]
device_name = "rohans-laptop"
test_mode_api_key = "rk_test_..."
test_mode_pub_key = "pk_test_..."
live_mode_api_key = "rk_live_..."

[my-project]
test_mode_api_key = "rk_test_..."
```

Project-specific config invoked via `stripe --project-name=my-project ...`. Notable: Stripe **respects `XDG_CONFIG_HOME`** and stores keys in plaintext TOML by default (with optional keyring integration). It's a clean modern example of XDG-native, profile-based design without aws's split-file complexity.

### 2.7 Supabase — TOML config-as-code, project-scoped

From [Supabase CLI docs](https://supabase.com/docs/guides/cli/config):

> A `supabase/config.toml` file is generated after running `supabase init`. You can edit this file to change the settings for your locally running project.

Supabase v2 uses **config-as-code**: the project's `supabase/config.toml` is the source of truth, checked into git, and `supabase config push` syncs it to the remote project. Auth lives separately (`supabase login` writes a token to `~/.supabase/access-token`).

The pattern: **project config tracked in repo, user auth state untracked at home.** This is the right model when project settings should be reproducible across the team. codealmanac's `.almanac/topics.yaml` already follows this; provider/model defaults could too.

### 2.8 Terraform — single user-level CLI config

From [Terraform CLI configuration docs](https://developer.hashicorp.com/terraform/cli/config/config-file):

- `~/.terraformrc` on Unix, `%APPDATA%/terraform.rc` on Windows.
- Override with `TF_CLI_CONFIG_FILE`.
- Settings are CLI-wide (plugin cache dir, credentials helpers, provider installation method) — *not* per-project. Per-project things go in `*.tf` files, which is a separate language.

```hcl
plugin_cache_dir   = "$HOME/.terraform.d/plugin-cache"
disable_checkpoint = true

credentials "app.terraform.io" {
  token = "xxxxxx.atlasv1.zzzzzzzzzzzzz"
}
```

Notable for codealmanac: Terraform deliberately keeps "tool config" and "project content" separate, and has no project-level CLI config because project settings belong in Terraform's own language. The lesson is about boundaries: don't put config that mostly affects the agent runtime in the same file as content the agent generates.

### 2.9 Docker — contexts as named bundles

`docker context` ([docs](https://docs.docker.com/engine/manage-resources/contexts/)) bundles endpoint URL, TLS material, and orchestrator into a named context. `docker context use prod` switches active context, persisted in `~/.docker/config.json`. `DOCKER_CONTEXT` env var overrides for a single shell. `--context` flag overrides for one command.

This is the cleanest model for "a bundle of provider connection details that the user picks one of" — directly analogous to "which AI provider is active" in codealmanac.

### 2.10 Quick comparison table

| CLI | Tiers | Override syntax | Diagnostics |
|-----|-------|-----------------|-------------|
| git | system / global / local / worktree | `-c key=value`, `GIT_CONFIG_*` | `git config --show-origin`, `--show-scope` |
| kubectl | single config sourced from many files | `--kubeconfig`, `KUBECONFIG` (colon list) | `kubectl config view`, `kubectl config current-context` |
| npm | builtin / global / user / project + env + CLI | auto-mapped `NPM_CONFIG_*` | `npm config list -l` |
| gh | single user config + per-host hosts.yml | `--host`, `GH_TOKEN`, `GH_HOST` | `gh auth status`, `gh config list` |
| aws | profiles in credentials + config | `--profile`, `AWS_PROFILE`, `AWS_*` per key | `aws configure list`, `aws sts get-caller-identity` |
| docker | named contexts | `--context`, `DOCKER_CONTEXT` | `docker context ls`, `docker context inspect` |
| terraform | single user CLI config | `TF_CLI_CONFIG_FILE`, `TF_*` per key | (none for CLI config; `terraform version`/`providers`) |
| stripe | profiles in TOML | `--project-name`, `STRIPE_API_KEY` | `stripe config --list` |
| supabase | project TOML + user auth token | `SUPABASE_*` per key | `supabase status`, `supabase projects list` |
| aider | YAML at home / repo-root / cwd, last wins | flags, `AIDER_*` env vars | `--show-help`, `--list-models` |

---

## 3. Universal references and conventions

### 3.1 clig.dev (Command Line Interface Guidelines)

[clig.dev](https://clig.dev/) is the closest thing to a modern POSIX-style standard. Key sections for our purposes:

**On configuration ([Configuration](https://clig.dev/#configuration)):**

> Follow the XDG-spec. In 2010 the X Desktop Group, now [freedesktop.org](https://freedesktop.org/), developed a specification for the location of base directories where config files should be located.

> If the program has lots of config, group it into sections — or split it into multiple files in a directory. Don't be afraid to ask the user for input.

**On environment variables ([Environment variables](https://clig.dev/#environment-variables)):**

> If you do use environment variables, namespace them with a prefix related to the name of your program, to avoid clashes. For example, `JAVA_HOME` rather than `HOME`.

> Be wary of using them for loading data that could change between invocations of a program... Configuration that is specific to a terminal session should be a flag.

**On naming**: lowercase, short, easy to type; one canonical name (no aliases that drift).

**On help**: lead with examples, support `-h` and `--help`, link to web docs, show concise usage when called with no args.

**On errors**: explain what happened, why, what to try next. Never just dump a stack trace.

**On the conversation metaphor**:

> Acknowledging the conversational nature of command-line interaction means you can bring relevant techniques to bear on its design. You can suggest possible corrections when user input is invalid, you can make the intermediate state clear when the user is going through a multi-step process, you can confirm for them that everything looks good before they do something scary.

This frames the entire design of `almanac doctor` and `almanac setup`: those are conversations, not state machines.

### 3.2 12-Factor App, factor III: Config

From [12factor.net/config](https://12factor.net/config):

> The twelve-factor app stores config in environment variables (often shortened to env vars or env). Env vars are easy to change between deploys without changing any code; unlike config files, there is little chance of them being checked into the code repo accidentally.

12-factor is about *deployed services*, not user-facing CLIs. Don't take it literally — CLIs absolutely should have config files. But take the sentiment: **anything that varies per-environment (API keys, hostnames, model names that change weekly) should also be settable via env var,** even if a config file is the primary surface. Aider does this perfectly: every `.aider.conf.yml` key has an `AIDER_<KEY>` env var equivalent.

### 3.3 XDG Base Directory Specification

From [the spec](https://specifications.freedesktop.org/basedir/latest/):

| Variable | Default | Purpose |
|----------|---------|---------|
| `$XDG_CONFIG_HOME` | `$HOME/.config` | user config files |
| `$XDG_DATA_HOME` | `$HOME/.local/share` | persistent user data (databases, indexes) |
| `$XDG_CACHE_HOME` | `$HOME/.cache` | regenerable cached data |
| `$XDG_STATE_HOME` | `$HOME/.local/state` | logs, history, recently-used lists |
| `$XDG_RUNTIME_DIR` | (no fallback; user must set) | sockets, pid files |

The spec is Linux-first but most modern CLIs follow it on macOS too (Stripe, gh, kubectl, helm). Notable holdouts: aws (`~/.aws/`), npm (`~/.npmrc`), Terraform (`~/.terraformrc`), git (still reads `~/.gitconfig` for backwards compat but checks `$XDG_CONFIG_HOME/git/config` first).

The split between `CONFIG`, `DATA`, `CACHE`, and `STATE` matters for codealmanac:

- The global registry (`registry.json`) is **state** — regenerable from `.almanac/` directories on disk if lost.
- `agent.default` and per-provider preferences are **config**.
- The compiled SQLite index inside each repo's `.almanac/` is **cache** (regenerable from pages).
- Capture log files are **state**.

We currently put everything under `~/.almanac/`, which violates XDG. Worth considering whether to migrate, or to commit to the AWS/npm precedent of "own the home dotfile" because the tool is small and self-contained.

### 3.4 POSIX/GNU flag conventions

- Short flags: `-v`, single letter, can be bundled (`-aux` = `-a -u -x`).
- Long flags: `--verbose`, `--config-file=path` or `--config-file path`.
- `--` ends flag parsing; everything after is positional.
- `-` alone means stdin/stdout.
- Boolean flags: `--foo` enables, `--no-foo` disables (clig.dev recommends always providing the negation form).
- Repeated flags either accumulate (`-v -v -v` = verbosity 3) or last-wins; document which.

GNU adds: subcommand-style (`git commit`, `kubectl get pods`) is now the dominant pattern for multi-purpose CLIs. clig.dev endorses it.

---

## 4. AI agent CLIs — newer patterns

The AI-agent CLI is a 2024-2026 phenomenon. Conventions are still settling. What follows is what each tool currently does, not a stable standard.

### 4.1 Claude Code (Anthropic's `claude` CLI)

Auth: `claude` runs an OAuth flow with claude.ai by default (Pro/Max subscription) or accepts `ANTHROPIC_API_KEY`. Credentials stored at `~/.claude/.credentials.json` (or system keychain on macOS). From [Claude Code authentication docs](https://code.claude.com/docs/en/authentication): "Claude Code supports multiple authentication methods depending on your setup. Individual users can log in with a Claude.ai account, while teams can use [...]".

Status check depends on Claude Code version. Current local/provider research for codealmanac uses `claude auth status --json` successfully, and the provider implementation treats that as the primary non-interactive readiness probe with `ANTHROPIC_API_KEY` as a fallback. Older Claude Code discussions referenced only the interactive `/status` slash command; treat those as stale for current implementation unless a user's installed `claude` lacks `auth status --json`.

Model selection: `/model` slash command persists to user settings. The settings file (`~/.claude/settings.json`) has a `model` field. Per-run override via `--model`. From [model-config docs](https://code.claude.com/docs/en/model-config): "Your /model selection is saved to user settings and persists across restarts."

### 4.2 OpenAI Codex CLI

Auth: `codex login` runs ChatGPT OAuth (recommended) or uses `OPENAI_API_KEY`. Credentials go to `~/.codex/auth.json`. From [Codex CLI reference](https://developers.openai.com/codex/cli/reference):

> Print the active authentication mode and exit with 0 when logged in. `codex login status` exits with 0 when credentials are present, which is helpful in scripts.

This is exactly the right shape: a status command that exits non-zero when not ready, suitable for `if codex login status; then ...` in shell.

Config files: `~/.codex/config.toml` for user-level, `.codex/config.toml` for project-level overrides ([Codex config basics](https://developers.openai.com/codex/config-basic)). Project file is loaded *additively* on top of user file — the same merge model as git's local-on-global. Per-run flags override either.

```toml
# ~/.codex/config.toml
model = "gpt-5"
model_provider = "openai"
approval_policy = "on-failure"

[shell_environment_policy]
inherit = "all"
exclude = ["AWS_*"]
```

Note `model` and `model_provider` are separate keys. This matters: a single key like `model = "openai/gpt-5"` (aider's pattern) collapses provider+model into one string, while Codex separates them. Both work.

### 4.3 Cursor CLI (`cursor-agent`)

From [Cursor CLI docs](https://cursor.com/docs/cli/overview): authentication via Cursor account (subscription handles billing). Inside a session, `/model` switches model. The CLI works with any model included in the Cursor subscription. Configuration surface is thin compared to Claude or Codex — Cursor abstracts model selection behind their subscription, and most knobs live in the GUI app's settings rather than the CLI.

For codealmanac this means: Cursor's "readiness" check is "is the user logged into Cursor?" There's no per-model availability concept exposed at the CLI level the way Codex has.

### 4.4 aider — the most config-heavy AI CLI

[aider](https://aider.chat/docs/config/aider_conf.html) supports three config locations, loaded in order with later wins:

1. `~/.aider.conf.yml` (home)
2. `<repo-root>/.aider.conf.yml`
3. `./.aider.conf.yml` (cwd)

Plus `.env` files in the same locations for API keys, plus per-flag env vars (`AIDER_MODEL`, `AIDER_EDITOR_MODEL`, etc.), plus CLI flags. The `--config <file>` flag bypasses the cascade and uses one file only.

Model selection across providers uses the LiteLLM convention: `--model openai/gpt-4`, `--model anthropic/claude-3-5-sonnet`, `--model gemini/gemini-2.0-flash`. The provider prefix tells aider which API to talk to and which env var to read for the key. **This `provider/model` string is the most copy-paste-friendly format I've seen for multi-provider CLIs.** It survives screenshots, copy-pastes, and shell history without ambiguity.

aider also has the concept of a **weak-model** and **editor-model** — multiple model slots that get used for different jobs. This generalizes: if codealmanac eventually wants a cheap/fast model for triage and a strong model for the actual writer, the structural shape is `[agents.writer] model = ...` / `[agents.triage] model = ...`.

### 4.5 GitHub Copilot CLI (`gh copilot`)

A `gh` extension. Auth piggybacks on `gh auth login`. Model is fixed by the Copilot subscription; users do not pick a model from the CLI. This is the simplest possible UX and fits when the vendor wants to abstract that away.

### 4.6 Cross-cutting AI CLI patterns

| Concern | Claude Code | Codex CLI | Cursor CLI | aider |
|---------|------------|-----------|------------|-------|
| User config | `~/.claude/settings.json` | `~/.codex/config.toml` | (mostly GUI) | `~/.aider.conf.yml` |
| Project config | `.claude/settings.json` | `.codex/config.toml` | `.cursor/` | `<repo>/.aider.conf.yml` |
| Auth method | OAuth + API key | OAuth + API key | Cursor account | API keys per provider |
| Auth file | `~/.claude/.credentials.json` | `~/.codex/auth.json` | (Cursor handles) | `.env` / env vars |
| Status command | `claude auth status --json` in current local probes; older versions may only expose `/status` interactively | `codex login status` | `cursor-agent status` / `whoami` with timeout | `aider --list-models` |
| Model selection | `/model` (interactive), `model` in settings, `--model` flag | `model` + `model_provider` in TOML, `--model` | `/model` interactive | `--model openai/gpt-4` |
| Multi-provider | single (Anthropic) | single (OpenAI) | single (Cursor) | many via LiteLLM |

**Pattern that's emerging across all of them:** project-level config in a `.<tool>/` directory next to the code, user-level config under `~/.<tool>/`, layered the same way git layers local-on-global. None of them follow XDG strictly. Codealmanac's `~/.almanac/` already matches this norm.

**Provider/model coupling**: aider, Codex, and Claude Code all treat "which provider" as primary and "which model" as secondary. This matches reality: a model name on its own (`gpt-5`, `claude-sonnet-4-6`) is meaningless without knowing which API to call.

**Readiness ≠ login**: Codex's `login status` and Claude's `auth status --json` check credential presence/login state, but they do not fully prove the configured model is callable. The honest readiness check requires (a) credentials present, (b) credentials valid, (c) the configured model accessible to those credentials. Most CLIs only do (a). codealmanac's `doctor` is well-positioned to report provider-owned status first and optionally add a deeper live probe later.

---

## 5. The diagnostics command — `doctor` vs `status`

Two patterns exist:

- **`status`** (gh, kubectl, supabase): lightweight, scoped to one concern. `gh auth status` only checks auth. `kubectl config current-context` only shows the active context.
- **`doctor`** (brew, rustup, flutter, codealmanac): full health sweep across many concerns. Each concern is a check that passes, warns, or fails, ideally with a one-line "run this to fix" suggestion.

The two are complementary, not competing. gh has both: `gh auth status` for the focused case, and the broader system info comes from `gh --version` + `gh extension list` + manual checks. flutter has `flutter doctor -v` as the canonical multi-check.

**`brew doctor` is the design archetype.** It runs ~30 checks, prints findings grouped by severity (Warning vs Error), and ends each finding with a remediation hint. It does not auto-fix — Homebrew's design is "tell the user what's wrong, let them fix it." This matches codealmanac's philosophy ("agents write directly; users read the diff in `git status`").

Output shape that works:

```
$ almanac doctor
codealmanac doctor

install
  ✓ binary           /Users/rohan/.npm/bin/almanac (v0.2.1)
  ✓ sqlite           native binding loaded
  ✗ claude auth      no credentials at ~/.claude/.credentials.json
                     run: claude /login

wiki (this directory)
  ✓ registered       /Users/rohan/Desktop/Projects/codealmanac/.almanac
  ✓ pages            42 pages, indexed at 2026-05-07T10:24:13Z
  ⚠ stale            12 pages not touched in 90+ days (run: almanac search --stale 90d)

3 ok, 1 warn, 1 fail
```

Key elements: severity prefix, two-column layout (check name → finding), remediation as `run: <command>` so it's easy to copy. `--json` for scripts. Exit code: 0 if no failures, non-zero if any.

`almanac doctor` already does roughly this. The `--json` flag and remediation hints are the differentiators worth keeping.

---

## 6. Onboarding wizards — what works and what doesn't

The dominant patterns:

1. **Interactive prompts with sensible defaults pre-filled**: `npm init`, `gh auth login`, `stripe login`. User can hit Enter through everything. Each prompt explains the choice ("Press Enter to use the default browser flow").
2. **Single-command bootstrap with no prompts**: `terraform init`, `cargo init`. The CLI infers what to do from the directory.
3. **One-shot OAuth handoff**: `gh auth login --web`, `stripe login`, `codex login`. Open browser, paste device code, done.

What doesn't work: long surveys, prompts that block CI, anything that asks a question whose answer the user doesn't have ("which model do you want?" — they don't know).

**clig.dev's guidance ([Interactivity](https://clig.dev/#interactivity)):**

> Only use prompts or interactive elements if stdin is an interactive terminal (a TTY). This is a reliable way to tell whether you're piped to another program or running in a script.

> If `--no-input` is passed, don't prompt or do anything interactive.

For codealmanac:

- `almanac setup` is the right entry point but should be:
  - **Idempotent**: re-running picks up where the user left off (already logged into Claude? skip that step).
  - **Non-blocking on TTY check**: if stdin isn't a TTY, fail with a clear error pointing at flags that would set the same values.
  - **Short**: 2-4 questions max. Provider choice, model preference (with default), and "do you want a project-local config?" is enough.
  - **Never asks for an API key directly**: defer to the provider's own login (`claude /login`, `codex login`, `cursor-agent login`). Print the command, optionally run it.

The proven shape (gh's flow):

```
$ almanac setup
? Which provider do you want to use? (Use arrow keys)
> Claude (Anthropic)
  Codex (OpenAI)
  Cursor

? How do you want to authenticate Claude?
> Login with Claude.ai (recommended)
  Use ANTHROPIC_API_KEY
  Skip — I'll authenticate later

? Default model? [claude-sonnet-4-6]

✓ saved to ~/.almanac/config.toml
✓ run `almanac doctor` to verify
```

Three Enter-presses to a working setup.

---

## 7. Security and credential storage

Every mature CLI separates credentials from preferences. Three patterns:

1. **System keychain** (gh, docker login, npm via `npm-keychain`): use the OS keychain (macOS Keychain, Windows Credential Manager, libsecret on Linux). Best UX, hardest to implement portably.
2. **Plaintext file with restrictive perms** (aws `~/.aws/credentials` with `chmod 600`, stripe `~/.config/stripe/config.toml`): simple, portable, fine for non-paranoid threat models. Document that it's plaintext.
3. **Delegate to the provider's own auth store** (codealmanac's current model): rely on `claude` having stored its credentials, `codex` having stored its, and just probe readiness. No credentials in our tree.

Pattern 3 is the right answer for codealmanac because:

- We already require Claude/Codex/Cursor CLIs as transports.
- Re-implementing OAuth flows for three providers is a maintenance burden we don't want.
- The provider's auth store is canonical — if it changes, we automatically pick it up.

The trap: when the provider's auth fails, our error message has to redirect to the provider's auth tool, not ours. "ANTHROPIC_API_KEY not set, run `claude /login`" — not "run `almanac auth claude`".

---

## 8. Env var naming

Convention: `<TOOLNAME>_<UPPER_SNAKE_KEY>`. Examples:

- npm: auto-generates `NPM_CONFIG_<KEY>` for every config key
- aws: `AWS_REGION`, `AWS_PROFILE`, `AWS_ACCESS_KEY_ID` (per-key)
- gh: `GH_TOKEN`, `GH_HOST`, `GH_CONFIG_DIR`
- terraform: `TF_VAR_<name>`, `TF_CLI_CONFIG_FILE`, `TF_LOG`
- aider: `AIDER_MODEL`, `AIDER_EDITOR_MODEL`, `AIDER_API_KEY`

For codealmanac the pattern is `ALMANAC_*`. Plausible names:

- `ALMANAC_HOME` — override `~/.almanac`
- `ALMANAC_CONFIG_FILE` — override config file path
- `ALMANAC_AGENT` — override active provider
- `ALMANAC_MODEL` — override default model (or `ALMANAC_<PROVIDER>_MODEL` per provider)
- `ALMANAC_NO_HOOK` — disable session-end capture (for CI)
- `ALMANAC_LOG_LEVEL` — debug knob

Avoid: re-using upstream variable names (`ANTHROPIC_API_KEY` belongs to Anthropic, don't shadow it), and don't invent variables for things that should be flags (per-invocation behavior).

---

## 9. Recommendations for codealmanac

This section compresses the above into specific, opinionated calls for our redesign. Not all of these have to land at once; they're listed in roughly the order they should be tackled.

### 9.1 Config tiers

Adopt three tiers, matching the git/Codex/aider consensus:

| Tier | Location | Scope | Tracked in git? |
|------|----------|-------|-----------------|
| user | `~/.almanac/config.toml` | per-user defaults | no |
| project | `.almanac/config.toml` (peer of `topics.yaml`) | per-repo overrides | yes (intentional — config-as-code) |
| (future) system | `/etc/almanac/config.toml` | per-machine for shared boxes | n/a |

System tier is YAGNI for now. Don't build it until someone asks.

The flat namespace `.almanac/` already exists; adding `config.toml` as a peer file is cheap. Having project config tracked in git is a feature: a team agrees that "this repo uses Claude Sonnet for capture" and it's reproducible.

### 9.2 Override precedence

Lock in this order, document it in `--help`, and test it:

```
flag  >  ALMANAC_* env  >  .almanac/config.toml  >  ~/.almanac/config.toml  >  built-in defaults
```

Where the built-in defaults are *visible*: ship a documented `prompts/defaults.toml` (not embedded in TS source) so users can see what they're inheriting.

### 9.3 File format

TOML, not YAML, not JSON. Reasons:

- TOML is what Codex, Stripe, and Cargo settled on for human-edited config. The convention has won for new CLIs in 2023+.
- TOML's table syntax handles the per-provider sub-config cleanly:

```toml
# ~/.almanac/config.toml
[agent]
default = "claude"

[agent.claude]
model = "claude-sonnet-4-6"

[agent.codex]
model = "gpt-5"
reasoning_effort = "medium"

[agent.cursor]
# Cursor handles model selection itself; nothing to set here.
```

- We already use YAML for `topics.yaml` (because that's a graph and YAML lists are compact). Using TOML for config keeps the formats domain-aligned: YAML for content shape, TOML for tool settings.

### 9.4 Provider first, model second

Use a hierarchical provider-then-model model for codealmanac's primary UX:

```bash
almanac capture --agent claude --model claude-opus-4-6
almanac agents use claude
almanac agents model claude claude-opus-4-6
```

Reasons: provider is the runtime choice, model is scoped to that runtime, and
this avoids ambiguous combinations like `--agent codex --model claude/opus`.
It also matches setup UX: choose provider first, then choose or inherit that
provider's model.

The provider/model string from aider remains useful as an optional shorthand,
not the primary canonical form:

```
claude/claude-sonnet-4-6
codex/gpt-5
cursor/auto
```

Reasons to keep it available later: it survives screenshots and shell history,
and it can be convenient for advanced users. But it should parse into the same
structured provider + provider-local model config, rather than replacing that
config model.

Where it appears:

- optional future `--agent claude/sonnet` shorthand
- optional future `almanac agents use claude/sonnet` shorthand
- docs/examples only after the hierarchical form is already supported

For users who want to set per-provider models so they can switch without retyping, accept the alternate form:

```toml
[agent]
default = "claude"

[agent.models]
claude = "claude-sonnet-4-6"
codex = "gpt-5"
cursor = "auto"
```

…and resolve at runtime: `default` picks the provider, `models[default]` picks
the model. This is the primary config shape. A future shorthand like
`claude/sonnet` should round-trip into this shape.

### 9.5 The `almanac config` subcommand

Build the same surface npm and gh have:

```
almanac config get <key>           # one value
almanac config set <key> <value>   # writes user config by default
almanac config set --project <key> <value>   # writes project config
almanac config list                # merged effective config
almanac config list --show-origin  # with provenance, like git
almanac config edit                # opens $EDITOR on the right file
almanac config unset <key>
```

`--show-origin` is the load-bearing one for debugging. Without it, users can't answer "why is codealmanac trying to use Codex when I configured Claude?"

### 9.6 The `almanac doctor` shape

Already mostly there. Tightening:

- Group output by category: `install`, `wiki`, `agent`. Don't mix concerns.
- Each line: `<status-glyph> <check-name>  <finding>` aligned, plus `run: <command>` on the next line for fixes.
- Severity glyphs: `✓` ok, `⚠` warn, `✗` fail. `--no-color` disables color but keeps glyphs.
- Exit codes: 0 if no `✗`, 1 if any `✗`. Warnings don't fail the exit code.
- `--json` emits `{ install: { ... }, wiki: { ... }, agent: { ... } }` with the same structure.
- Categories worth having: `install` (binary, sqlite, hook, CLAUDE.md import), `wiki` (registered, page count, index freshness, capture age, health problems), `agent` (per-provider readiness using the provider's own status command).

The agent readiness check should call out to the provider's tool, not duplicate logic. Per §7, a pseudo-implementation:

```
agent
  ✓ active            claude
  ✓ claude            credentials present (claude auth status --json), model claude-sonnet-4-6 configured
  ⚠ codex             not logged in (run: codex login)
  ⚠ cursor            not installed (run: npm i -g cursor-agent)
```

Probing reachability is a 1-token API call. Skip if the user passes `--offline`.

### 9.7 The `almanac setup` shape

Replace the current "claude, codex, or cursor?" prompt with a wizard that:

1. Detects which provider CLIs are installed and which are already logged in (call `claude auth status --json`, `codex login status`, etc.).
2. Pre-selects the most-likely default in the prompt.
3. Asks at most three questions: provider, model, write project config or just user config.
4. On Enter without input, accepts the pre-filled default.
5. After writing config, runs `almanac doctor --quiet` and prints a one-line "ready" or points at the failure.
6. Exits 0 on success, prints `Run \`almanac search\` to start using the wiki.`

Bail behaviors:

- `stdin` not a TTY → exit 1, print "almanac setup is interactive. Use `almanac config set` to script it."
- `--non-interactive --provider claude --model claude-sonnet-4-6` → write config and skip prompts.

### 9.8 Env var naming

Lock in:

| Variable | Purpose |
|----------|---------|
| `ALMANAC_HOME` | override `~/.almanac` (tests already need this; `withTempHome` should set it) |
| `ALMANAC_CONFIG_FILE` | bypass the cascade, use one file |
| `ALMANAC_AGENT` | override active provider |
| `ALMANAC_MODEL` | override active model as a provider-local model string |
| `ALMANAC_NO_HOOK` | suppress session-end capture (for CI) |
| `ALMANAC_LOG_LEVEL` | `debug` / `info` (default) / `error` |

Don't shadow upstream vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. stay theirs.

### 9.9 Auth — delegate, never store

Codify the existing pattern:

- codealmanac never reads, writes, or stores provider credentials.
- Each provider module has a `readiness()` method that shells out to the provider's own status check.
- When a provider isn't ready, the error message names the provider's login command, not ours.
- There is no `almanac auth` subcommand. If users ask for one, push back; the right answer is `claude /login` or `codex login`.

This matches the existing CLAUDE.md ("Claude auth lives under the Claude provider. Generic agent status code should not import Claude-specific auth plumbing") and should be elevated to non-negotiable.

### 9.10 What not to build

Recording these so they don't creep back in:

- **No profiles.** AWS-style `--profile work` adds a dimension we don't need; users have one provider active at a time, and the alternate is `--agent codex` for one command.
- **No system-tier config** until a user with a multi-tenant box requests it.
- **No interactive credential entry.** Always defer to the provider.
- **No `--dry-run` for setup.** It's already idempotent; rehearsal isn't a feature (matches our existing anti-pattern list).
- **No environment-aware config (`config.dev.toml`, `config.prod.toml`).** That belongs in env vars per 12-factor; CLIs aren't deployed services.

### 9.11 Migration path from the current shape

Today: flat `agent.default` and `agent.models` in (presumably) JSON or YAML in `~/.almanac/`. To get to §9.3:

1. Ship a TOML reader and a fall-back JSON/YAML reader that emits a deprecation warning. Existing users keep working.
2. `almanac config edit` writes TOML on save. After one or two releases, drop the JSON/YAML fall-back and require migration via `almanac config migrate` (one-shot, idempotent).
3. Project-tier config is opt-in; don't auto-create `.almanac/config.toml` during `almanac init` unless the user passes `--with-config` or runs `almanac config set --project ...`.

Don't turn this into a slice with a propose/apply flow. It's straightforward additive work: add the cascade reader, add the `config` subcommand, then design the wizard against the new surface.

---

## 10. Sources

Primary docs (read these directly when implementing):

- [clig.dev](https://clig.dev/) — Command Line Interface Guidelines
- [12factor.net/config](https://12factor.net/config) — env-var-based config principle
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/)
- [git-config(1)](https://git-scm.com/docs/git-config) — tiered config + `--show-origin`
- [npmrc docs](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc) — cascade order
- [kubectl: Organizing Cluster Access](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/) and [Mastering KUBECONFIG](https://medium.com/@ahmetb/mastering-kubeconfig-4e447aa32c75)
- [GitHub CLI manual](https://cli.github.com/manual/) — `gh auth status`, `gh config`
- [AWS CLI configuration files](https://docs.aws.amazon.com/cli/v1/userguide/cli-configure-files.html)
- [Stripe CLI login](https://docs.stripe.com/cli/login) — XDG-native TOML
- [Supabase CLI config](https://supabase.com/docs/guides/cli/config) — config-as-code
- [Terraform CLI configuration file](https://developer.hashicorp.com/terraform/cli/config/config-file)
- [Docker contexts](https://docs.docker.com/engine/manage-resources/contexts/)
- [Codex CLI reference](https://developers.openai.com/codex/cli/reference) and [config-basic](https://developers.openai.com/codex/config-basic)
- [Claude Code authentication](https://code.claude.com/docs/en/authentication) and [model-config](https://code.claude.com/docs/en/model-config)
- [Cursor CLI overview](https://cursor.com/docs/cli/overview)
- [aider YAML config](https://aider.chat/docs/config/aider_conf.html), [aider .env config](https://aider.chat/docs/config/dotenv.html), [aider model aliases](https://aider.chat/docs/config/model-aliases.html)

Specific behaviors confirmed against official docs above; speculative claims (e.g. that Codex's project-config merge is "additive on top of user file") are based on what config-basic states, which I quoted directly. If implementing, re-read the config-basic page — Codex iterates fast.

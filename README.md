<p align="center">
  <img src="docs/assets/readme-hero.png" alt="Almanac — A living wiki for your codebase">
</p>

<p align="center">
  <a href="https://pypi.org/project/codealmanac/"><img alt="PyPI version" src="https://img.shields.io/pypi/v/codealmanac?label=pypi&color=2ea043"></a>
  <a href="https://pypi.org/project/codealmanac/"><img alt="Python versions" src="https://img.shields.io/pypi/pyversions/codealmanac?color=1f6feb"></a>
  <a href="https://github.com/AlmanacCode/codealmanac/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/AlmanacCode/codealmanac?style=flat&logo=github"></a>
  <a href="https://github.com/AlmanacCode/codealmanac/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/AlmanacCode/codealmanac"></a>
  <a href="./LICENSE.md"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-df7b40"></a>
  <a href="https://www.codealmanac.com"><img alt="Website" src="https://img.shields.io/badge/website-codealmanac.com-24292f"></a>
</p>

CodeAlmanac is a self-updating wiki for your codebase.

Your agent sessions die the moment they end. The decisions, architecture, and
dead-ends inside them never compile into anything the next session can
reference. CodeAlmanac is that reference layer: a wiki that lives in your
repository, written for your agents, and kept up to date from the work itself.

## At a glance

- Public command: `codealmanac`
- Python 3.12+
- Install: `curl -fsSL https://www.codealmanac.com/install.sh | sh`
- Manual install: `uv tool install --python 3.12 codealmanac`
- Default repo wiki root: `almanac/`
- Custom repo wiki roots: any safe repo-relative directory via `--root`
- User state root: `~/.codealmanac/`
- Cloud commands: `setup`, `login`, `whoami`, `logout`, `capture`, `repo`,
  and `runs`
- Local commands live under `local`

## Get started

Install the CLI:

```bash
curl -fsSL https://www.codealmanac.com/install.sh | sh
```

Manual install:

```bash
uv tool install --python 3.12 codealmanac
# or: python -m pip install codealmanac
```

**With your team (cloud)** — one shared wiki, updated from everyone's sessions,
delivered back to the repo as commits or pull requests:

```bash
codealmanac setup           # GitHub sign-in + agent instructions
codealmanac capture enable  # capture Codex/Claude sessions as source
codealmanac repo setup      # configure the current repo in the browser
```

Agents can run setup too: `codealmanac setup --no-browser` prints the login URL
for a human to approve, and `codealmanac whoami` confirms the identity.

**On your machine (local)** — your repo, your agent credentials, no cloud
automation:

```bash
cd your-repo
codealmanac init
codealmanac local setup --branch main --delivery commit
codealmanac search "getting"
codealmanac show getting-started
```

Read commands work without cloud login. Local update jobs use your local agent
credentials and write back to your working tree or local commits, depending on
the branch delivery policy.

<p align="center">
  <img src="docs/assets/readme-search.gif" alt="Terminal showing codealmanac search and show commands against a repo wiki">
</p>

## What gets created

The wiki is plain markdown committed to your repository, under `almanac/` by
default (`docs/almanac/` or any repo-relative directory via `--root`):

```text
your-repo/
|-- almanac/
|   |-- README.md          # this repo's notability bar and conventions
|   |-- topics.yaml        # topic graph
|   |-- manual/            # packaged guidance copied for agents
|   |-- pages/
|   |   |-- checkout-flow.md
|   |   |-- stripe-webhook-deadlock.md
|   |   `-- jwt-vs-sessions.md
|-- src/
`-- ...
```

Every page is one stable concept: a flow, a decision, a gotcha, or an
invariant. Pages link into a topic graph with `[[wikilinks]]`. Browse locally
with `codealmanac serve`, or in the cloud with `codealmanac open`.

A folder counts as a CodeAlmanac wiki only when it has both `topics.yaml` and
`pages/`. Derived local state appears when commands need it: `index.db` and
user-level job records are runtime state, not part of the init scaffold.

## Principles

1. **Written for your agents.** The primary reader is the AI agent working in
   your repo. Pages carry what the code can't say: decisions, invariants,
   gotchas, flows, and known failure modes.
2. **It's part of your repository.** Plain markdown, committed next to the
   code, every change reviewable in git. You own the wiki, and it travels with
   every clone.
3. **Maintained, not just generated.** One page per stable concept, a
   notability bar for what deserves a page, edits in place when facts change.
   If a session adds no durable knowledge, the wiki is left unchanged. Silence
   is a valid outcome.

## Built for retrieval

The markdown is the source of truth; a derived SQLite index makes it queryable,
so the right context reaches the agent at the right moment:

```bash
codealmanac search --mentions src/checkout/   # every page about these files,
                                              # before the agent edits them
codealmanac search "auth"                     # full-text search over the wiki
codealmanac show checkout-flow                # read one page
```

The instruction files installed by `setup` teach Codex and Claude Code to query
the wiki before touching unfamiliar code. Read commands never invoke a model and
need no credentials.

## Commands

| Command | Purpose |
|---|---|
| `codealmanac` | Open the cloud wiki for the current checkout. |
| `codealmanac open` | Open the cloud wiki for the current checkout. |
| `codealmanac setup` | Cloud sign-in plus agent instructions. |
| `codealmanac login` / `whoami` / `logout` | Manage cloud auth. |
| `codealmanac capture status` | Show Codex/Claude capture status. |
| `codealmanac capture enable --target codex` | Enable Codex session capture. |
| `codealmanac capture disable` | Disable capture hooks and revoke the capture token. |
| `codealmanac repo setup` | Open browser setup for the current repo. |
| `codealmanac repo triggers enable <branch> --delivery pr\|commit` | Choose how cloud updates land for a branch. |
| `codealmanac runs list\|show\|logs` | Inspect cloud update runs. |
| `codealmanac runs start --branch <branch>` | Start a cloud run for a maintained branch. |
| `codealmanac init` | Build the first local wiki for the current repo. |
| `codealmanac local setup --branch main --delivery commit` | Configure local branch triggers and delivery. |
| `codealmanac local update --using codex` | Run a local wiki update now. |
| `codealmanac local triggers enable dev --delivery commit` | Maintain another branch locally. |
| `codealmanac local jobs list` | Inspect local update jobs. |
| `codealmanac search` / `show` / `topics` / `health` | Query the local wiki. |
| `codealmanac serve` | Start the local wiki viewer. |
| `codealmanac doctor` | Check install, auth, providers, automation, and wiki health. |

Run `codealmanac <command> --help` for the full flag surface. Local schedules
stay behind explicit local or automation commands. `codealmanac uninstall --yes`
removes setup-owned local artifacts; `codealmanac uninstall --yes
--keep-automation` leaves local scheduled automation in place.

## Install troubleshooting

The installer uses `uv tool install` so CodeAlmanac lives in an isolated Python
tool environment. If an older npm or editable checkout shadows the installed
binary, the installer prints both paths. Put `uv tool dir --bin` earlier on
`PATH`, then run:

```bash
codealmanac --version
codealmanac setup
```

## Privacy

Capture is opt-in, per provider, and reversible. `capture status` shows exactly
what is on, and `capture disable` removes hooks and revokes the stored capture
credential. CodeAlmanac never stores your Codex or Claude provider credentials.
Wiki content is canonical in your repository: every change arrives as a commit
or PR you can review, amend, or reject.

## Contributing

```bash
git clone https://github.com/AlmanacCode/codealmanac.git
cd codealmanac
uv sync
uv run pytest
uv run ruff check .
```

If CodeAlmanac helps your agents understand a codebase faster, please consider
giving the repo a star.

## Status

CodeAlmanac is pre-1.0 and under active development. Breaking changes are
possible before 1.0 and will be called out in release notes.

## License

Apache License 2.0. See [LICENSE.md](./LICENSE.md).

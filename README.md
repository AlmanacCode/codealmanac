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

## Get started

Install the CLI (Python 3.12+):

```bash
uv tool install codealmanac
# or: python -m pip install codealmanac
```

**On your machine** — your repo, your agent credentials:

```bash
codealmanac init            # build the first wiki for this repo
codealmanac local setup     # keep it updating from your commits
```

**With your team (cloud)** — one shared wiki, updated from everyone's
sessions, delivered back to the repo as PRs or commits:

```bash
codealmanac setup           # GitHub sign-in + agent instructions
codealmanac capture enable  # capture Codex/Claude sessions as source
```

Agents can run setup too: `codealmanac setup --no-browser` prints the login
URL for a human to approve, and `codealmanac whoami` confirms the identity.

## What gets created

The wiki is plain markdown committed to your repository, under `almanac/` by
default (`docs/almanac/` or any repo-relative directory via `--root`):

```text
your-repo/
|-- almanac/
|   |-- README.md          # this repo's notability bar and conventions
|   |-- topics.yaml        # topic graph
|   `-- pages/
|       |-- checkout-flow.md
|       |-- stripe-webhook-deadlock.md
|       `-- jwt-vs-sessions.md
|-- src/
`-- ...
```

Every page is one stable concept — a flow, a decision, a gotcha — linked into
a topic graph with `[[wikilinks]]`. Browse it locally with `codealmanac
serve`, or in the cloud with `codealmanac open`.

## Principles

1. **Written for your agents.** The primary reader is the AI agent working in
   your repo. Pages carry what the code can't say — decisions, invariants,
   gotchas, flows — so the next session starts with context instead of
   archaeology.
2. **It's part of your repository.** Plain markdown, committed next to the
   code, every change reviewable in git. This is
   [docs as code](https://www.writethedocs.org/guide/docs-as-code/): you own
   the wiki, and it travels with every clone.
3. **Maintained, not just generated.** One page per stable concept, a
   notability bar for what deserves a page, edits in place when facts change.
   If a session adds no durable knowledge, the wiki is left unchanged —
   silence is a valid outcome.

## Built for retrieval

The markdown is the source of truth; a derived SQLite index makes it
queryable, so the right context reaches the agent at the right moment:

```bash
codealmanac search --mentions src/checkout/   # every page about these files,
                                              # before the agent edits them
codealmanac search "auth"                     # full-text search over the wiki
codealmanac show checkout-flow                # read one page
```

The instruction files installed by `setup` teach Codex and Claude Code to
query the wiki before touching unfamiliar code. Read commands never invoke a
model and need no credentials.

## Commands

| Command | Purpose |
|---|---|
| `codealmanac init` | Build the first wiki for the current repo. |
| `codealmanac local setup` | Configure local self-updating: branch policy + git hooks. |
| `codealmanac local update` | Run a local wiki update now. |
| `codealmanac search` / `show` / `topics` / `health` | Query the wiki. |
| `codealmanac serve` | Local wiki viewer. |
| `codealmanac setup` | Cloud sign-in plus agent instructions. |
| `codealmanac capture enable\|status\|disable` | Manage session capture. |
| `codealmanac repo triggers enable <branch> --delivery pr\|commit` | Choose how cloud updates land. |
| `codealmanac runs list\|show\|logs` | Inspect cloud update runs. |
| `codealmanac doctor` | Check install, auth, and wiki health. |

Run `codealmanac <command> --help` for the full flag surface.
`codealmanac uninstall --yes` removes setup-owned local artifacts.

## Privacy

Capture is opt-in, per provider, and reversible — `capture status` shows
exactly what is on, `capture disable` removes hooks and revokes the stored
credential. CodeAlmanac never stores your Codex or Claude provider
credentials, and wiki content is canonical in your repository: every change
arrives as a commit or PR you can review, amend, or reject.

## Contributing

```bash
git clone https://github.com/AlmanacCode/codealmanac.git
cd codealmanac
uv sync
uv run pytest
uv run ruff check .
```

If CodeAlmanac helps your agents understand a codebase faster, please
consider giving the repo a star.

## Status

CodeAlmanac is pre-1.0 and under active development. Breaking changes are
possible before 1.0 and will be called out in release notes.

## License

Apache License 2.0. See [LICENSE.md](./LICENSE.md).

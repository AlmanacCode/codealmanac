# codealmanac

A living wiki for codebases, maintained by AI coding agents. Documents what the code can't say: decisions, flows, invariants, incidents, gotchas.

The primary consumer is the AI coding agent. The secondary consumer is humans.

## Install

```bash
npm install -g codealmanac
```

This installs two binaries: `codealmanac` (canonical) and `almanac` (alias). Both point to the same entry point.

## Quickstart

```bash
cd my-repo
almanac init --name my-repo --description "what this repo is"
# ✓ creates .almanac/ with pages/ and README.md
# ✓ registers the wiki in ~/.almanac/registry.json
# ✓ adds .almanac/index.db to .gitignore

almanac list
# Shows every registered wiki on this machine.
```

The wiki lives at `.almanac/` in each repo: a committed markdown directory that future agents read and update.

## Commands in this release (slice 1)

- `almanac init` — scaffold `.almanac/` in the current directory, register globally
  - `--name <name>` — wiki name (defaults to kebab-case of the directory name)
  - `--description <text>` — one-line description
- `almanac list` — list registered wikis
  - `--json` — structured output
  - `--drop <name>` — remove a wiki from the registry (the only way entries are ever removed)

Later slices add `search`, `capture`, `topics`, `bootstrap`, and the writer/reviewer pipeline.

## Design

- **Local only.** `.almanac/` per repo, `~/.almanac/registry.json` globally. No hosted service.
- **Flat namespace.** Everything in `.almanac/` directly — no `.almanac/wiki/` subdir.
- **README.md as the guide.** GitHub renders it when someone browses to `.almanac/`.
- **Registry is additive.** Entries are never auto-dropped. Unreachable paths are silently skipped in output; `--drop <name>` is the only explicit removal.
- **Silent auto-registration.** When you run `almanac` in a repo that has `.almanac/` but isn't registered, it registers silently. Cloning a repo and running any command just works.

See the full design at [docs/ideas/codebase-wiki.md](https://github.com/AlmanacCode/codealmanac) in the spec.

## License

MIT. Copyright (c) 2026 Rohan Sheth.

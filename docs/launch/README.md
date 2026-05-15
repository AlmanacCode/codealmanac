# Launch Kit

This folder holds copy that maintainers can adapt when sharing Almanac. Treat it as source material, not a script.

## One-line Pitch

Almanac is a local-first codebase wiki for AI coding agents. It captures the decisions, flows, invariants, and gotchas that code cannot explain by itself.

## Short Launch Post

AI coding agents can read code, but they usually lose the "why" between sessions.

Almanac stores that missing context as a local wiki inside each repo. It writes atomic markdown pages for decisions, flows, invariants, and gotchas, then indexes them so future agents can search before editing.

Try it:

```bash
npx codealmanac
cd your-repo
almanac init
almanac search "auth"
```

Repo: https://github.com/AlmanacCode/codealmanac
Site: https://usealmanac.com/code

## Show HN Draft

Title:

```text
Show HN: Almanac - a local wiki for AI coding agents
```

Body:

```text
Hi HN,

I built Almanac, a local-first codebase wiki for AI coding agents.

The problem: agents can read code, but they usually cannot recover why a subsystem is shaped a certain way, what broke before, which files move together, or what gotchas previous sessions discovered.

Almanac stores that missing context in `.almanac/` inside the repo as atomic markdown pages. It indexes the pages locally, supports search by concept or file mention, and lets lifecycle commands use an AI provider only when building or updating the wiki.

The core workflow:

npx codealmanac
cd your-repo
almanac init
almanac search "auth"
almanac show checkout-flow

Storage is local. Changes are git-reviewed. Query commands are pure local search over files and SQLite.

Repo: https://github.com/AlmanacCode/codealmanac
Site: https://usealmanac.com/code
```

## X / Twitter Thread Draft

```text
AI coding agents can read your code.

They still lose the "why" between sessions: decisions, gotchas, invariants, and cross-file flows.

That is what Almanac is for.
```

```text
Almanac creates a local `.almanac/` wiki inside your repo.

Agents can search it before editing:

almanac search "checkout timeout"
almanac search --mentions src/checkout/
almanac show checkout-flow
```

```text
It is local-first:

- markdown pages in the repo
- SQLite index as a cache
- git-reviewed wiki edits
- no hosted service required
```

```text
Try it:

npx codealmanac

Repo: https://github.com/AlmanacCode/codealmanac
Site: https://usealmanac.com/code
```

## Reddit / Dev.to Draft

```text
I have been working on Almanac, a local-first codebase wiki for AI coding agents.

The idea is simple: code tells an agent what exists, but it often does not explain why a workaround exists, what failed before, how a workflow crosses files, or which invariant future edits must preserve.

Almanac captures that kind of context in `.almanac/` as markdown pages. The pages are indexed locally, so agents can search by concept or by file mention before editing.

It is meant to be boring infrastructure: local files, SQLite cache, git-reviewed changes, and a CLI that stays scriptable.

Quick start:

npx codealmanac
cd your-repo
almanac init
almanac search "auth"

Repo: https://github.com/AlmanacCode/codealmanac
Site: https://usealmanac.com/code
```

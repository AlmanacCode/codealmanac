# Launch BF: Almanac (S26) — a self-updating wiki for your coding agents

Hey Bookface! We're @Rohan Sharma, @Kushagra Chitkara, and @Divit Sheth — the founders of @Almanac.

**TL;DR**: Every new Claude Code / Cursor / Codex session starts from zero. [Almanac](https://github.com/AlmanacCode/codealmanac) turns your past agent conversations into a connected Markdown wiki that lives inside your repo, so your agents stop rediscovering the same context every time. Open source, local, free. Try it: https://github.com/AlmanacCode/codealmanac

[VIDEO: 35s demo — you ask Claude Code a question, it runs `codealmanac search` and `codealmanac show`, and answers from a decision your team made months ago]

Here's what that looks like: you ask your agent to add Okta SSO. Instead of re-deriving your auth setup from the code, it queries the wiki — and finds the page where you already chose WorkOS over Auth0 in March, plus the webhook-replay gotcha from a June debugging session. It walks in knowing.

## How it works

1. You install the CLI and pick your agent (Claude Code, Codex, Cursor).
2. Almanac scans your codebase and generates an initial wiki.
3. A background job reads your agent conversations every few hours and updates the wiki with the important things you discussed: architecture, decisions, conventions, gotchas.
4. Your agent queries the wiki automatically before it codes — `codealmanac search`, `codealmanac show`.

That's it. The next session walks in already knowing your context, so you stop re-explaining the same things every time.

[IMAGE: product screenshot — the Authentication wiki page]

## "Another codebase-memory tool? 😭"

Since Karpathy's LLM-wiki tweet, a lot of tools have chased this idea. Most of them build a pretty graph and call it a wiki. A graph is not a wiki.

A wiki is detailed, connected Markdown articles that an AI can natively query — and keeping one true is a full-time job. Three things we do that we haven't seen together anywhere else:

- **It updates on your conversations.** The context that matters — why you picked WorkOS, what broke in the June incident, which invariant must never be violated — never makes it into docs. It lives in your agent conversations. Almanac reads them and writes the wiki, so documentation happens as a side effect of working.
- **It gardens itself.** The first wiki ever built (WikiWikiWeb, 1995) already had a "WikiGardener" — someone who prunes stale pages and reorganizes messy areas. Outdated docs are worse than no docs, so an agent gardens your wiki on a schedule: merging, pruning, restructuring as facts change. The wiki grows into the new shape of your codebase instead of being constrained by its old one.
- **It's agent-native, and yours.** Plain Markdown in `almanac/`, committed to your repo, diffable in `git status`. Your agent queries it through a CLI, not a hosted API. Everything runs locally on your own Claude/Codex subscription — no API keys, no server, no data leaving your machine.

## What ends up in the wiki

The stuff the code can't say:

- **Decisions** — "WorkOS over Auth0: enterprise connections were priced per-connection, SCIM needed a separate add-on."
- **Gotchas** — "WorkOS retries webhooks and doesn't dedupe; handlers must use idempotency keys. Found in the June 3 incident."
- **Invariants** — "Every identity provider goes through `src/auth/workos.ts`. Never call provider APIs directly."
- **Flows** — how checkout, auth, or indexing actually works end to end, across files.

Every page is linked to the others and to the files it describes, so `codealmanac search --mentions src/auth/` finds the pages about the code your agent is about to touch.

## Why this needs to exist

- Coding agents are amnesiacs: every session starts from zero.
- CLAUDE.md / AGENTS.md doesn't scale past a page — it becomes a junk drawer nobody prunes.
- Human-written docs go stale the week after they're written.
- Meanwhile the real context — decisions, trade-offs, incidents — is already being said out loud, to your agent, every day. It's just being thrown away after every session.

Your agent already discussed the fix in March. It just doesn't remember.

## Who we are

We're @Rohan Sharma (ex-ML research at the Vector Institute, CMU, and MIT), @Kushagra Chitkara (MS Data Science, Harvard), and @Divit Sheth (ex-Senior SWE at Arcesium). We grew up together in India, met 11 years ago prepping for the JEE, and have been close friends ever since.

We've spent the last year and a half building AI-native wikis and have been contributing to Wikipedia and Fandom for a while now. If you can't tell already, we're *obsessed* with wikis.

[IMAGE: team selfie — assets/team-photo.jpg]

## Traction

We're launching throughout this week! Our earlier MVP got **6k downloads in a week** and we're currently sitting on **171 GitHub stars**. We've been running Almanac on our own repos for the past month — it's how this codebase documents itself.

## Our ask

Try it on your codebase and tell us what works and what breaks: https://github.com/AlmanacCode/codealmanac — a ⭐ genuinely helps.

If you use coding agents heavily, we'd love to hear how you manage context today.

**Enterprise/private wikis:** we're starting to build private domain-specific wikis for AI companies (e.g. grounding a customer-facing agent). If that's you, reach out: rohan@usealmanac.com or +1 6173888465.

Thanks!
Rohan, Kushagra & Divit

# Transcripts of reference posts

## 1. Our current draft — "Launch BF: Almanac (S26)"

> **Launch BF: Almanac (S26) — a self-updating wiki for your coding agents**
>
> Hey Bookface! We're @Rohan Sharma, @Kushagra Chitkara, and @Divit Sheth - the founders of @Almanac.
>
> **TL;DR**: Every new Claude Code / Cursor / Codex session starts from zero. [Almanac](https://github.com/AlmanacCode/codealmanac) turns your past agent conversations into a connected Markdown wiki that lives inside your repo, so your agents stop rediscovering the same context every time. Open source, local, free. Try it: https://github.com/AlmanacCode/codealmanac
>
> **How it works**
>
> 1. You install the CLI and pick your agent (Claude Code, Codex, Cursor).
> 2. Almanac scans your codebase and generates an initial wiki.
> 3. A background job reads your agent conversations every few hours and updates the wiki with the important things you discussed: architecture, decisions, conventions, gotchas.
> 4. Your agent reads the wiki automatically before it codes.
>
> That's it. The next session walks in already knowing your context, so you stop re-explaining the same things every time.
>
> [IMAGE: Product screenshot — a wiki UI in warm cream tones. Left sidebar: Authentication (selected), Session management, Single sign-on, Rate limiting; under a DATA heading: Background runs, Search indexing. Main pane: "Authentication" page with a LIVE badge — "Maintained by Almanac — updated just now · synced from 4 sources." Subtitle: "How a request proves who it is — and the invariants that keep it safe." Sections: "Token refresh" (Access tokens are short-lived and minted through Session management. Refresh tokens rotate on every use, so a leaked token is valid only until the next refresh; the login route is guarded by Rate limiting.) An INVARIANT callout box: "A refresh token is single-use. Replaying one that has already rotated revokes the entire session chain — never cache one across requests." Section "Single sign-on": Runs the OIDC authorization-code flow with PKCE. We decided against long-lived JWTs — smaller blast radius if one leaks. Right rail: ON THIS PAGE (Token refresh, Single sign-on, Revocation), LINKED FROM (auto): Session management, Login flow, Maintained branch.]
>
> **Who we are**
>
> We're @Rohan Sharma (ex-ML research at the Vector Institute, CMU, and MIT), @Kushagra Chitkara (MS Data Science, Harvard), and @Divit Sheth (ex-Senior SWE at Arcesium). We grew up together in India, met 11 years ago prepping for the JEE, and have been close friends ever since.
>
> We've spent the last year and a half building AI-native wikis and have been contributing to Wikipedia and Fandom for a while now. If you can't tell already, we're *obsessed* with wikis.
>
> [IMAGE: Team selfie — three founders in an office, wood-paneled walls, desks with monitors behind them. assets/team-photo.jpg]
>
> **Traction**
>
> We're launching throughout this week! Our earlier MVP got **6k downloads in a week** and we're currently sitting on **171 GitHub stars**.
>
> **Our ask**
>
> Try it on your codebase and tell us what works and what breaks: https://github.com/AlmanacCode/codealmanac — a ⭐ genuinely helps.
>
> If you use coding agents heavily, we'd love to hear how you manage context today.
>
> **Enterprise/private wikis:**
>
> We're starting to build private domain-specific wikis for AI companies (e.g. grounding a customer-facing agent). If that's you, reach out to me: rohan@usealmanac.com or +1 6173888465
>
> Thanks!
> Rohan, Kushagra & Divit
>
> [LINK CARD: GitHub - AlmanacCode/codealmanac: A codebase wiki for AI coding agents. Captures what the code can't say: decisions, flows, invariants, gotchas. — 5 contributors · 3 issues · 169 stars · 16 forks]

## 2. Reference post — Greptile (W24), Daksh Gupta, 2y ago

> **Launch BF: Greptile, RAG on complex codebases that actually works.**
>
> Hello Bookface! @Vaishant Kameswaran, @Soohoon Choi, and I are the co-founders of Greptile.
>
> Greptile lets developer teams **search** and **understand** complex codebases in plain English. For example, a developer can ask: **"How does auth work in this codebase?"** 👉 and get accurate answers with relevant code refs. Less time wrangling the codebase means more time shipping features, faster!
>
> Developers at nearly 200 companies including Stripe (S09) and Amazon are using Greptile every day. Now we're doing our first set of enterprise pilots.
>
> [IMAGE: Product screenshot — dark chat UI. Query "How does session management work in this app?" → 22 results, file list (/src/app/api/auth/[...nextauth]/route.ts etc.), followed by a structured answer: 1. NextAuth Configuration (/src/options.ts)… 2. Session Callback…]
>
> **Another RAG on a codebase tool? 😭**
>
> At Greptile, we focus *exclusively* on **full codebase comprehension** - using LLMs to accurately answer difficult questions with full context of large, complex, and even multi-repo codebases.
>
> RAG is not sufficient for this task - codebases aren't like PDFs, docs, or other similar data types. They are graphs - complex puzzles where each piece is interlinked.
>
> Greptile does a few things past RAG:
>
> 1. Instead of directly embedding code, we parse the **Abstract Syntax Trees** of the codebase, recursively generate docstrings for each node in the tree, and then embed the strings.
> 2. Alongside vector similarity search and keyword search, we do **"agentic search"** where an agent reviews the relevance of the search results, and views the source code to follow references that might lead to something important. Then it returns the relevant sources.
>
> Does it work? Yes! Here's Felix from Twenty (S20):
>
> [IMAGE: Email screenshot — felix@twenty.com: "I've tried several tools like yours, usually excited by the promise and disappointed by the result. Yours gave me the best answer I've ever had so far! I'll keep using it and see if it's useful. Feel free to share it on our Discord!"]
>
> 🦎 **Greptile in action** →
>
> Here are some ways I use Greptile 👇
>
> **Understanding how something works in a certain repo** →
> [IMAGE: Query "How does this app authenticate users with GitHub?" → 6 results + numbered breakdown of the GitHub OAuth flow]
>
> **Pasting in an error message and getting accurate diagnosis + fixed code** →
> [IMAGE: Runtime TypeError pasted → 3 results → diagnosis that props.topics is undefined + corrected JSX snippet]
>
> **Locate code when I don't know exact keywords** →
> [IMAGE: "Where is the code that configures the auth providers?" → 1 result /src/options.ts + explanation of providers configured]
>
> **Adding dependencies to the same Greptile session and getting custom integration help** →
> [IMAGE: Two repos in session (onboardme + stripe-node), query about usage-based billing]
>
> **Other things some of our users use it for** →
>
> 1. Narek Galstyan from Lantern (W24): grokking postgreSQL's source code, which Lantern is built on.
> 2. Rahul Behal from AgentHub (W24): parsing OSS frameworks that AgentHub integrates with.
> 3. Jack Chapman from Cardinal Gray (S23): generating E2E test cases for multi-file services.
> 4. Isaiah Granet from Intelliga Voice (S23): integrating with the Twilio node SDK.
> 5. SWE at Thera (S22): writing new features that require complex, multi-file changes.
> 6. SWE at Stripe (S09): debugging internal Rust libraries.
> 7. Principal Engineer at Microsoft: reviewing his team's code (open source).
> 8. TMO (old B2B software company): working with their legacy .NET code.
>
> …and more
>
> **Why does this need to exist?**
>
> As software companies grow:
>
> 1. Codebases get more **complex**.
> 2. **Legacy code** and **tech debt** accumulates.
> 3. Docs are usually **outdated**.
> 4. **Original engineers leave**, new engineers are less familiar with the code.
>
> To get around this, developers:
>
> 1. Just brute force their way to grokking the code - which is hard and time consuming.
> 2. Seek help from the subject matter expert, which is difficult if they have left, work remote, or are just busy.
> 3. Try to use tools like GitHub copilot, which are not really designed to answer with full code context, so they fail to deliver.
>
> In fact, the thing that makes coding hard is usually the codebase, not the code!
>
> **We want Greptile to be able to accurately answer any question that the most experienced, smartest engineer at your company can.**
>
> GREPTILE! GREPTILE! GREPTILE!
>
> Trying to grok a complicated OSS repo? Your own codebase getting complicated?
>
> Try Greptile → app.greptile.com
>
> Want greptile for your team? Want a beautiful bag of this 100% pure Colombian Arabica coffee roasted right here in Silicon Valley to maximize innovation juice?
>
> Book a demo → greptile.com/demo
>
> [IMAGE: Coffee bag photo next to a plant]

## What the Greptile post does well (notes for the rewrite)

- Opens with a plain-English capability + a concrete example question in the first two sentences.
- Anticipates the skeptic's objection as a header ("Another RAG on a codebase tool? 😭") and answers it with specific mechanisms, not adjectives.
- Social proof is concrete and named (Felix's verbatim email, named users with companies + batch).
- "In action" section is a list of real use cases, each with a screenshot.
- "Why does this need to exist" is a tight causal chain, ending in a memorable one-liner ("the thing that makes coding hard is usually the codebase, not the code").
- One-sentence mission statement in bold.
- Playful energy (GREPTILE! GREPTILE! GREPTILE!, coffee bag) without diluting the substance.

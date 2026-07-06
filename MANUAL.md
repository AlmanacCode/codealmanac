# The Manual — How We Build

> **Shared across our repos.** §0–§5 are universal and must be kept in sync.
> §6 is repo-specific. This is an *explanation* doc, not a checklist — you
> reason *from* it. Read it before implementing any feature.

## 0. The reframe (the spine)

The unit of work is **not "build the feature."** It is:

> *evolve the codebase — refactoring if needed — so the feature fits, then build it.*

Two consequences follow, and both are first-class:

- **Refusal is a valid output.** "We shouldn't build this yet, or not like
  this" — said with the architectural reason — is often the most valuable
  thing you can do. AI makes *typing* cheap, so features get requested
  casually; your job is to protect the shape, not just satisfy the request.
- **Re-architecting to fit a feature is normal, not heroic.** If the clean way
  to add X is to reshape Y first, that *is* the task.

## 1. The stance: living architecture

- **Code is never frozen.** Every feature begins by reading the whole shape and
  asking *"does this fit, or does it reveal the shape should change?"*
- **Naming is architecture.** The moment you can name a thing's general role, it
  earns a first-class home. (A transport helper became a first-class
  `integrations/` boundary the moment "external systems we call" became a
  nameable axis.)
- **Seam vs. machinery — the precise antidote to blunt YAGNI.** Naive YAGNI
  ("don't build what you won't use") wrongly forbids the seams that keep the
  future cheap. The refinement:
  - Build **seams** eagerly — a boundary, a name, a typed contract, the *shape*.
    Cheap, clarifying, where the future slots in. (a typed event boundary; a
    `kind` field that's a one-value `Literal` today; a result type that's
    deliberately neutral about what consumes it.)
  - Build **machinery** lazily — the N implementations, the dispatcher, the
    config surface. Expensive, speculative.
  - **"Anticipate the future" = get the seams right, defer the machinery.**
  - Test a seam: *when feature X lands, is it additive against this seam, or a
    teardown?* Teardown ⇒ the seam is wrong; fix it now, while it's cheap.

## 2. The ritual (run this before writing code)

1. **Intent + its future.** What's asked — and what *near-future* features does
   it imply? Name them. You're designing for the second and third feature too,
   not just this one.
2. **Prior art.** How have others built this shape? Spin a subagent or search
   the web. An hour of "how do mature tools structure this" prevents a wrong
   abstraction. Think critically; borrow shape, not code.
3. **Locate the axis.** Which axis does this vary? Does a seam for it exist? Is
   this the *second concrete case* (build the seam) or the *first* (build one
   honest path, leave a clean boundary)?
4. **The flag check — the load-bearing step.** *Does the current architecture
   hold this cleanly?* If **no → stop. Do not bolt it on.** Flag it explicitly:
   *"the current shape doesn't support X cleanly because Y; here's the
   re-architecture I'd propose."* Then **think with the user, invite pushback,
   and construct the architecture together.** Spend real time here — this is the
   most important conversation, not an interruption to the "real work."
5. **Wireframe it** (§3) and show it in the chat. Argue about the shape *there*.
6. **Refactor if needed, then build.**

## 3. How we talk about architecture — the wireframe habit

Whenever you convey the *feel* of code, show a **pseudocode wireframe in the
chat**: the names, the rough shape, the responsibility split, the rationale, and
*how it feels to call*. **Use dot notation wherever relevant.** Wireframes are
the default medium for any non-trivial shape — not a single diagram at the end,
but the running language of the design conversation. A wireframe says: *this
concept will be named X, here is roughly how the code looks, here is why
responsibilities split this way.* Example:

```python
# arch: intake decides whether/how · the worker decides nothing · one writer
outcome = almanac.updates.handle_trigger(trigger)         # product truth lives here
kind    = almanac.updates.choose_delivery(facts, settings) # the ONLY place a fact picks a delivery
bundle  = worker.run_update(req)                           # dumb orchestration; returns a neutral result
almanac.updates.delivery.run(bundle, kind, settings)      # source-agnostic strategy, the sole writer
```

The wireframe *is* the design-review surface. We agree on the shape before any
real code exists.

## 4. Principles you reason from (with examples)

**Boundaries & decoupling**
- *Separate by reason-to-change, enforced by location.* Each module has exactly
  one reason to change; its directory says which.
- *A decision is not a mechanism.* "if it's a fork, open a PR instead of
  committing" is a **configurable policy in a selection step**, never an
  `if is_fork` buried *inside* the commit code. Decisions are separable and,
  ideally, configurable; mechanisms are source-blind.
- *Intelligence lives in the brain, not the orchestration.* Judgment (what to
  write, what matters) lives in prompts/agents. Orchestration is mechanical.
  Config knobs are *where / whether / how*, never *what*.
- *Don't be narrower than your dependency's contract.* If the tool you drive
  already speaks a general language (e.g. a source-ref of many kinds), don't
  hard-code yourself down to one kind — you've thrown away free generality.
- *Raw external shapes don't leak past the normalization boundary.* Parse once
  at the edge into typed values; nothing downstream touches the raw payload.

**Craft (line-level gorgeousness)**
- Typed models for all shaped data; enumerations are `Literal`/enums; **no loose
  `dict`** for structured data (opaque external passthrough is the only
  exception — and you *comment* that it's deliberate).
- **No `getattr`/`hasattr`/`setattr`/dynamic attribute access.** Static access
  only. (Dict `.get()` on parsed JSON is data access — fine.)
- Uniform error contracts; **redact secrets** in error paths; capture subprocess
  output fully and truncate only at the boundary where you surface it.
- **Structured contracts before text scraping.** If a provider, SDK, CLI, or
  local API can return typed output, use that contract instead of extracting
  semantics with regexes over prose, prompts, logs, or final assistant text.
  Regex is fine for syntax we own (frontmatter fences, Markdown paths, durations,
  path normalization, known URL forms) or as a documented compatibility shim.
  It is not a product boundary for summaries, actions, identities, state
  transitions, or other durable meaning. Before adding extraction logic, check
  whether the tool already supports structured output, metadata, JSON mode,
  result files, or a typed event.
- **Defense in depth on invariants** — re-validate a safety invariant at every
  layer that could violate it (e.g. "changed files stay under the configured
  root" is checked in the producer *and* re-checked before the write).
- Honest names + scoping docstrings. *A docstring that over-claims generality is
  a bug.* Names teach the next agent how to extend the system.

**Judgment**
- **Delete dead compatibility layers once callers have moved.** A husk left
  "for the migration" that nothing imports is debt, not safety.
- Treat existing special cases as **provisional** until they earn their place.
  AI leaves locally-effective one-offs that were never consciously accepted as
  architecture — an `if` that should be a registry is a smell, not a feature.
- Weigh special cases by cost and evidence. A narrow exception with high
  maintenance cost needs strong justification; a small localized shim with a
  real compatibility/platform reason can stay.

## 5. When *not* to build

Because AI makes building cheap, the default failure mode is *over-building on a
misshapen base*. Two refusals are first-class outputs, not evasions:

- **"This doesn't fit cleanly — let's re-architect first."** (the flag of §2.4)
- **"This isn't worth its architectural cost yet."** (the machinery for one
  speculative case, before a second concrete case exists)

Say either plainly, with the reason, and turn it into an architecture
conversation.

## 6. Repo-specific instantiation — codealmanac

- Only lifecycle operations invoke AI or write page prose. Read commands may
  refresh derived local index state and read committed markdown for display or
  validation. Organization commands may deterministically rewrite wiki metadata
  through explicit verbs such as `tag`, `topics`, `review`, and `migrate`.
- **Intelligence lives in prompts, not pipelines.** No propose/review/apply
  state machines, no orchestration JSON schema between writer and reviewer, no
  `--dry-run` rehearsals. The writer owns outcomes.
- Local-only repo wiki tree plus `~/.codealmanac/registry.json` global state.
  New repos use `almanac/` only. `docs/almanac/`, `.almanac/`, custom roots,
  and compatibility aliases are retired.
- The committed wiki source is a browseable nested Markdown tree under
  `almanac/`. Runtime state belongs under `~/.codealmanac/`, not in the
  committed wiki tree. The source shape is:
  ```text
  almanac/
  |-- README.md
  |-- topics.yaml
  |-- architecture/
  |   |-- README.md
  |   `-- indexing.md
  |-- decisions/
  |   `-- local-first.md
  `-- guides/
      `-- setup.md
  ```
- Page identity is the path under `almanac/` without `.md`; `README.md` is the
  folder landing page. Use Markdown links for page links and `sources:` for
  file evidence. Wikilinks and legacy file-list frontmatter are retired.
- `GLOB` not `LIKE` for path queries. Paths normalized on both sides of a
  comparison.
- Slices: plan → build → review → fix → next. The review pass is where latent
  bugs surface; don't collapse it.

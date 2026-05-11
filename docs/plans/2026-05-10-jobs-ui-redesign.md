# Jobs viewer redesign — decision log

Started 2026-05-10. Owner: Claude (Opus 4.7).

## Why

The jobs UI shipped in commits `42b2ef9` → `7d2e704` was functional but felt
out of place in the viewer. The rest of the viewer is **editorial**: Palatino
serif, cream paper, navy accent, dingbat ornaments, hero-with-kicker, quiet
page rows with chips. Jobs shipped as a **dashboard**: 4-cell run-ledger,
twin Settings/Outcome panels of monospaced key/value tiles, a redundant
3-cell "impact" grid pinned to every row.

The information was right; the visual register was wrong. This redesign keeps
the data, swaps the register.

## Design principles (held while redesigning)

1. **Match the viewer's existing register.** Hero kicker + serif title +
   muted prose deck. Ornament where a section break needs weight. Chips for
   taxonomy, not for state.
2. **One representation per fact.** The old detail page showed
   created/updated/archived in three places — strip, settings panel, outcome
   panel. Pick one.
3. **Prose over grids.** "147 runs recorded — 3 active, 142 completed"
   reads better than a 4-tile stat grid, and matches the
   "{N} pages and {M} topics indexed" line on the overview page.
4. **Group by day.** A run history is a logbook. Group rows under
   "Today / Yesterday / Mar 8" labels — that gives the page rhythm without
   filter chrome.
5. **State as a dot, not a pill.** Pills are loud. A `●` glyph in
   sage/navy/burgundy + the word reads like an editorial mark.
6. **Don't touch transcript internals.** The tool-card and chat-bubble work
   is fine; only the surrounding chrome (avatar, section heading) changes.

## Concrete shape

### List page

```
[kicker]   LEDGER
[title]    Run history
[deck]     147 runs recorded in .almanac/runs —
           3 active, 142 completed, 2 need attention.

──────── Today ────────
  14:32   absorb · claude / sonnet-4
          {displayTitle}
          {displaySubtitle}
          ● Completed · +3 created, 2 updated · 3m 24s

  09:14   garden · claude / sonnet-4
          ...

──────── Yesterday ────────
  ...
```

- Time column: `HH:MM` in mono, fixed width, left.
- Kicker: `operation · provider / model` — small caps, accent color.
- Title: serif, 18px.
- Summary: muted, two-line clamp.
- Tally line: dot + status word + impact (only non-zero counts) + elapsed.
  No chips here; chips are for taxonomy elsewhere.

### Detail page

```
[kicker]   ABSORB
[title]    {displayTitle}
[deck]     {displaySubtitle}
[chips]    ● Completed   claude · sonnet-4   3m 24s   absorb-target

───────────── colophon ─────────────
  Started     2026-05-10 14:32     Created    3
  Finished    2026-05-10 14:35     Updated    2
  Provider    claude / sonnet-4    Archived   0
  Turns       4                    Tokens     12,432
  Cost        $0.18                Log        .almanac/runs/...
  Session     {providerSessionId}

[if failure]
  Failure — {message}
  Fix — {fix}

[if targets]
  Targets
  {chips of paths}

           ✥

Transcript · {N} events
  ...
```

- Colophon: one `<dl>`, two columns on wide screens, one column on narrow.
  Small-caps `dt`, serif `dd`, mono only when the value is a path/hash.
- Failure: standalone callout with left border in accent; not a fact row.
- Targets: chip row, separate section so it doesn't get lost in the dl.
- Ornament `✥` divides above-fold metadata from the transcript, matching
  page header treatment elsewhere.

## What I deliberately did NOT change

- `jobs-transcript.js` parser and `buildTranscript` / `getToolCardModel`.
- Tool card open/close, fact grid inside tool cards, code blocks.
- API shape — pure frontend redesign.
- Status taxonomy (queued / running / done / failed / cancelled / stale).
- Color tokens. The dots reuse existing `--ca-accent`, `--ca-sage`, and a
  derived burgundy for failure.

## Open questions for reviewer

1. Is "LEDGER" the right kicker for the list page? Alternatives: "RUNS",
   "JOBS LOG". I chose "Ledger" because the viewer already uses words like
   "almanac" — "ledger" carries the same archival feel.
2. The colophon two-column layout on the detail page — should it instead
   be a flowing definition list (one column, all the way down) for easier
   scanning? I picked two-column because the metadata count is high (10+
   fields) and a single column scrolls past the fold.
3. Day grouping uses **local time** of the user's browser. If a run
   crosses midnight UTC, the label is whatever the viewer's clock says.
   Acceptable for a local viewer; flagging in case it's not.

## After-thoughts (filled in as work progresses)

### Round 1 review (claude review agent, 2026-05-10)

Findings accepted and applied:

- **`.ca-tool_result` typo** — but reviewer was wrong on the rename direction.
  `tool_result` is never a `kind` value (only `read/write/edit/search/shell/
  mcp/web/agent/image/unknown` per `normalizeToolKind`). The selector was
  dead. Same for `.ca-tool-error`. Both deleted rather than renamed.
- **`statusMark(includeLabel)` confused param** — accepted; flag removed,
  word always wraps in `<span class="ca-status-word">`.
- **`prefers-reduced-motion` guard** — accepted, added.
- **Elapsed duplicated in chips row and colophon** — accepted; removed
  from colophon. Chips row is the scannable home for duration.
- **Tally density** — accepted; turns and tokens removed from list tally.
  Headline facts (status, impact, elapsed) only. Colophon carries the
  rest.
- **Orphan-row border bug** — accepted; the `nth-last-child(2):nth-child
  (odd)` rule only worked for specific row counts. Replaced with simple
  `:last-child` and the outer `<dl>` border closes the block visually.
- **`display: grid` no-op on `.ca-log-day-list`** — accepted; switched
  to `display: block`.
- **Local-time comment** — accepted; added at `dayKey`.

Findings rejected / overridden:

- None outright. The reviewer was conservative and right on all six
  should-fixes. The one place I diverged was the must-fix rename: the
  dead selectors should be deleted, not renamed, since the kind values
  they purported to match don't exist.

Open questions, settled:

1. "Ledger" kicker — kept. Reviewer leaned same way, flagged "Logbook"
   as a future option. Revisit if real users get confused.
2. Two-column colophon — kept with the simpler border rule.
3. Day grouping in local time — kept, comment added.

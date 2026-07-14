# Fixes: slice 141 section-search review

## Review outcome

The section projection, versioned rebuild, FTS query analyzer, and typed result
evidence are correctly placed and the full suite passes. Real-wiki searches put
the expected cancellation and path-normalization pages first. The review found
no must-fix correctness defects and two should-fix gaps before release.

## Should fix

### Collapse and limit pages in SQLite

The implementation orders every matching section, returns all rows to Python,
then removes duplicate pages and applies the user limit. A page with many
matching sections therefore inflates transfer and Python work even when the
caller asks for a small result set. Rank sections per page in SQL, retain the
best section, apply the final page ordering and limit there, and remove the now
redundant Python collapse.

Add a regression proving that a limit counts unique pages rather than matching
sections and still retains the best evidence for each page.

### Verify the new public evidence and weighting contracts

The implementation carries `matched_heading` and `excerpt` into the viewer
DTO, and the ranking weights prefer titles and headings over body-only matches,
but the tests stop at the index service. Extend existing viewer/server tests to
assert the additive evidence fields and add a focused ranking test. These are
public behavior boundaries and should not be left implicit.

## Consider

- The excerpt is a bounded slice of authored Markdown rather than fully
  rendered plain text. Keep this honest source excerpt for now: stripping
  Markdown would add a second content representation without evidence that the
  visible punctuation harms consumers.
- Common question words remain eligible OR terms by design. The real-wiki
  probes ranked the intended pages first; add stop-word policy only if measured
  retrieval failures justify its language and identifier trade-offs.

## Verification

- Focused read-model, viewer, server, and query tests.
- Synthetic projection/search timing with many pages and sections.
- `uv run pytest`.
- `uv run ruff check .`.


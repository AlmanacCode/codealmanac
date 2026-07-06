---
title: Working On CodeAlmanac
summary: Short workflow for agents changing this repository.
topics: [operations, agents]
sources:
  - id: manual
    type: file
    path: MANUAL.md
    note: Required build philosophy.
  - id: tickets
    type: file
    path: implementation-tickets.md
    note: Ordered implementation tickets.
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Historical agreement that still has useful code-quality context.
---

# Working On CodeAlmanac

Read `MANUAL.md` before implementing a feature [@manual]. The unit of work is to reshape the codebase so the feature fits, then build it.

Follow `implementation-tickets.md` in order for the current rebuild [@tickets]. Later tickets depend on the page tree, source model, links, runtime layout, validation, and prompt/manual import from earlier tickets.

Use the current refactor plan as product truth while coding. Do not carry hosted/cloud behavior, legacy command aliases, alternate roots, registry-file state, root hopping, or old page-layout compatibility into new work.

Use `uv run pytest` and `uv run ruff check .` as the default gates. Use narrower tests first when a ticket names focused verification.

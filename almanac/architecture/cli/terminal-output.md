---
title: Terminal Output
topics: [architecture, cli]
sources:
  - id: style
    type: file
    path: src/codealmanac/cli/render/style.py
    note: Shared terminal styling, ANSI handling, tables, and duration formatting.
  - id: common-render
    type: file
    path: src/codealmanac/cli/render/common.py
    note: Shared JSON and index-summary render helpers.
  - id: search-render
    type: file
    path: src/codealmanac/cli/render/search.py
    note: Search and reindex render behavior.
  - id: cli-tests
    type: file
    path: tests/test_cli.py
    note: CLI tests that assert terminal text, stderr, JSON output, and exit behavior.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Architecture tests that keep Rich and render ownership at the CLI render edge.
---

# Terminal Output

Terminal output is behavior in CodeAlmanac. The CLI render modules own the human text, JSON output, ANSI styling, empty-result messages, and table formatting that users and scripts see [@style] [@common-render] [@search-render]. Tests assert exact output for many commands, so changing wording, stderr placement, color behavior, or JSON shape can be a product change [@cli-tests].

This is why rendering is separated from parsing and dispatch. The [CLI Adapter Boundary](adapter-boundary) turns command-line input into app calls; render modules turn app results back into terminal contracts. Services should return structured models, not preformatted terminal prose.

## Human Text And JSON

Render functions usually accept a structured result and a `json_output` flag. Shared helpers in `cli/render/common.py` print Pydantic models and tuples of models as indented JSON with `model_dump(mode="json")` [@common-render]. Human render paths format the same result for reading.

Search output shows the pattern. `render_search` prints JSON rows when `--json` is set. In human mode, it prints each result slug, optionally a summary, and writes `# 0 results` to stderr when there are no matches [@search-render]. Reindex follows the same split: JSON uses the shared model printer, while human output prints `reindexed: ...` with an index summary [@search-render] [@common-render].

The tests lock this in. They check that `search login` prints a slug, `search login --slugs` suppresses the summary, missing search results produce no stdout and `# 0 results` on stderr, and `reindex --json` includes structured fields such as `pages_indexed` [@cli-tests].

## Styling

`cli/render/style.py` centralizes ANSI styling. `use_color()` returns true only when stdout is a TTY and `NO_COLOR` is not set, and every palette property resolves through that check [@style]. This gives the same render functions colored output for humans and plain output for pipes.

The same file owns ANSI-aware table width helpers. `visible_length` strips ANSI escape codes before measuring text, and `table` uses that width calculation so colored headers and cells still align [@style]. Duration helpers such as `humanize_duration` and `humanize_elapsed` also live there because they are presentation decisions, not service data.

Rich terminal UI is kept at the render edge. The architecture test `test_rich_terminal_ui_stays_in_cli_render_edge` fails if modules outside `cli/render` import `rich` [@architecture-tests]. That keeps services and workflows independent from terminal libraries.

## Error And Stream Placement

The CLI treats stdout and stderr deliberately. `main()` prints product and validation errors to stderr with the `codealmanac:` prefix, while renderers choose stderr for advisory or empty-result messages when stdout should stay machine-friendly [@cli-tests] [@search-render]. For example, empty search writes only to stderr, leaving stdout empty [@cli-tests].

This distinction supports scripts. A command can emit human warnings without polluting stdout, and `--json` remains the structured piping format described in the styling module docstring [@style].

## Render Ownership

Render modules are split by output family: search output lives in `search.py`, health and validation output in `health.py`, run and job output in their own modules, setup output under `render/setup`, and shared helpers in `common.py` and `style.py`. Architecture tests require the root render modules to remain facades and forbid them from growing direct rendering logic [@architecture-tests].

When changing terminal output, treat the renderer and its tests as the contract. Add or update structured service fields first, then adapt the relevant render module. Do not make services import terminal styling, print directly, or return text that only the CLI can understand.

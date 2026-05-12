# Jobs stream UI garden

Date: 2026-05-11

## Goal

Make the jobs detail stream easier to understand and easier to change. The current implementation renders events, but the transcript projection and HTML rendering live together in `viewer/jobs-view.js`, and tool calls do not read like first-class chat activity.

Also add instant page suggestions to the viewer search box using the same extracted-module pattern. Search suggestions are a reusable interaction surface and should not be embedded directly in the main router.

## Inspiration reviewed

- `../openalmanac/gui/src/surfaces/conversations/MessageBubble.tsx`
- `../openalmanac/gui/src/surfaces/conversations/ToolIndicator.tsx`
- `../openalmanac/gui/src/domains/tasks/conversationMessages.ts`
- `../openalmanac/frontend/src/components/quill/ToolCallCard.tsx`

Useful patterns:

- Assistant text should stay as simple chat messages.
- Tool activity should be compact by default and expandable on demand.
- Tool calls and tool results should be paired by ID before rendering.
- Agent/subagent tool calls need a distinct visual treatment from file, shell, search, and web tools.
- Raw JSON is still valuable, but it should be supporting detail rather than the first thing the user sees.
- Search suggestions should debounce input, cancel stale requests, support keyboard navigation, and render page-shaped rows.

## Decisions

1. Add `viewer/jobs-transcript.js` as a pure frontend projection module. It owns event grouping, text accumulation, tool/result pairing, and display model derivation.
2. Keep the viewer runtime build-free. The new module is plain ESM loaded by `viewer/jobs-view.js`.
3. Render tool activity with native `<details>/<summary>` controls. That gives accessible expansion without adding state plumbing.
4. Keep typed server-side run parsing in `src/viewer/jobs.ts`; do not duplicate process-manager storage rules in the browser.
5. Test the projection module directly with Vitest so future UI changes can move markup without breaking stream semantics silently.
6. Add `viewer/search-suggestions.js` as a shared browser module. The shell wires it once, while the module owns debounce, abort, keyboard selection, and dropdown rendering.
7. Add `/api/suggest` as a bounded page-search endpoint over the same FTS path as `/api/search`, returning only the top suggestions.

## Implementation log

- Extracted transcript projection from `viewer/jobs-view.js`.
- Added pairing for `tool_use` and `tool_result` events that share an ID.
- Added compact tool display models for read/write/edit/search/shell/web/agent/mcp/unknown events.
- Updated job detail rendering to use expandable tool cards with input/result sections.
- Added direct unit tests for transcript accumulation, invalid-line preservation, done-result handling, and tool result pairing.
- Added a small declaration file for the JS transcript module so TypeScript tests can import it without weakening compiler checks.
- Added `/api/suggest`, wired instant sidebar search suggestions, and added asset/server/API coverage.

## Out of scope

- Browser screenshot/UI regression testing. The user explicitly asked to leave UI testing for now.
- A React rewrite or build pipeline for the viewer.
- Changing provider log formats.

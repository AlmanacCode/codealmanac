# Notion Connector Contract

## Goal

Almanac should be able to ingest selected Notion content into a repo wiki as distilled project memory. Notion is a source of human, product, research, planning, and decision context; the codebase is the source of implementation truth; the `.almanac/` wiki is the synthesized layer that future coding agents read first.

The feature must not turn Almanac into a Notion mirror. The output of a Notion ingest is edited wiki pages about durable concepts, decisions, workflows, constraints, gotchas, product context, and project terminology.

## Product Principle

External connectors are evidence sources, not wiki replicas.

When Almanac ingests Notion, it reads selected Notion pages, data sources, or search results, compares them against the existing wiki and codebase when relevant, and writes only information that will help future coding sessions. Notion URLs and object IDs remain provenance. The wiki becomes the compiled operating memory.

## User Experience

The user should be able to connect Notion once, then invoke Notion as an ingest source.

Recommended command shape:

```bash
almanac connect notion
almanac connectors status
almanac ingest notion
almanac ingest notion --page <notion-url-or-id>
almanac ingest notion --data-source <notion-url-or-id>
almanac ingest notion --query "connector strategy"
almanac disconnect notion
```

`connect` grants and stores access. `ingest` uses the connected source. `disconnect` removes Almanac's local connection record and invalidates or forgets the credential path where possible.

The first implementation may support a narrower set:

```bash
almanac connect notion
almanac ingest notion
almanac ingest notion --page <notion-url-or-id>
```

The architecture must still treat Notion as one implementation of a general connector interface.

`almanac ingest notion` without a selector means "scan the connected Notion corpus that Almanac is allowed to access, select relevant source items, and absorb only the durable project knowledge." It does not mean "copy every Notion page into `.almanac/`."

## General Connector Model

Notion is the first concrete connector. The interface should be general enough for future sources such as Google Drive, Slack, Linear, GitHub, local folders, or other knowledge systems.

Each connector should provide:

```typescript
interface KnowledgeConnector {
  id: string;
  auth: ConnectorAuthAdapter;
  discover(request: DiscoverRequest): Promise<SourceItem[]>;
  read(item: SourceItem): Promise<SourceDocument>;
  normalize(document: SourceDocument): Promise<NormalizedSourceBundle>;
}
```

The connector layer is responsible for access, discovery, reading, pagination, rate-limit handling, and provenance. The connector layer is not responsible for deciding what belongs in the wiki.

The Absorb writer remains responsible for wiki judgment:

- whether the source contains durable project knowledge
- whether to update an existing page or create a new page
- whether to no-op
- whether to verify a claim against code
- how to link, cite, and topic the resulting pages

## Notion Auth

The contract supports three auth paths, but implementation should start with the simplest one that preserves the interface.

### Composio

This is the recommended v1 implementation.

`almanac connect notion` should create a Composio connected-account link session, open the returned authorization URL in the user's browser, wait for the user to authorize Notion, poll or confirm the connected-account status, and store only the local connection reference needed to use that account later.

Composio is prioritized for v1 because it supports Notion OAuth2 and API-key authentication, handles connected accounts, and gives Almanac the browser-based "click authorize" connection UX without requiring Almanac to own the full OAuth app, callback, and token refresh implementation immediately.

Composio must remain an adapter behind the connector interface, not the core connector model. Almanac should be able to support direct Notion auth and Composio-backed auth without changing Absorb or wiki-writing behavior.

If Composio managed OAuth is used, the implementation must use Composio's current link-session flow for redirectable managed OAuth configs. As of May 2026, Composio documents `POST /api/v3/connected_accounts/link` as the migration path for managed OAuth flows that return redirect URLs.

### Direct Notion OAuth

This is a future first-party flow if Almanac later owns the authorization experience.

Notion public connections use OAuth 2.0. Users choose which pages to share during authorization or through Notion's "Add connections" flow. The ingest must explain missing-page failures in terms of connection sharing and permissions, not as generic API failures.

### Local Token or PAT

This is a fallback path for local development, CI-like tests, or users who do not want to use Composio.

The user provides a Notion token through an environment variable, local config secret reference, keychain entry, or explicit non-interactive option. The token must never be committed into `.almanac/`, source files, logs, run specs, or generated wiki pages.

## Notion Source Resolution

The Notion connector should support these source selectors:

- no selector: search/discover the connected Notion corpus that Almanac can access and let Absorb select relevant project knowledge
- `--page <url-or-id>`: read one page and selected child blocks recursively
- `--data-source <url-or-id>`: query entries in a Notion data source and read selected pages
- `--query <text>`: search shared Notion pages/data sources by title, then let the ingest context choose relevant results

The connector must not claim it has full workspace coverage. Notion search only returns pages and data sources shared with the connection and subject to the connection's capabilities. A no-result response may mean the page was not shared with the connection.

For `almanac ingest notion` with no selector, the connector should discover accessible pages and data sources through Notion/Composio search or listing capabilities, then build a bounded candidate set for Absorb. Relevance is decided by Almanac's wiki-writing prompt and existing wiki/code context, not by blindly importing every discovered source item.

## Notion Reading Rules

For page ingest:

1. Resolve the page ID from a Notion URL or raw ID.
2. Retrieve page metadata: title, URL, created time, last edited time, parent, and properties.
3. Retrieve block children.
4. Recursively retrieve child blocks when blocks have children.
5. Convert supported block types into plain markdown-like text.
6. Preserve unsupported block markers as explicit omissions instead of silently inventing content.
7. Include stable provenance for every document: connector id, object id, URL, title, and last edited time.

For data source ingest:

1. Resolve the data source ID from a Notion URL or raw ID.
2. Query pages from the data source with pagination.
3. Support optional filters or limits before broad ingest.
4. Fetch page content only for selected entries.
5. Include data source properties as metadata, not as wiki prose by default.

For query ingest:

1. Use Notion search to find shared pages or data sources.
2. Prefer recently edited or title-relevant results.
3. Cap result count by default.
4. Include the result list in the Absorb context so the writer can choose what to inspect.

For broad Notion ingest:

1. Discover accessible pages and data sources.
2. Prefer explicit user-shared pages, recently edited pages, pages with project-like titles, and pages linked from selected data sources.
3. Cap the number of fully fetched pages by default.
4. Pass titles, URLs, edit timestamps, and excerpts for the broader candidate set.
5. Fully fetch only the selected high-signal pages.
6. Ask Absorb to no-op when the selected corpus does not contain project-relevant durable knowledge.

## Normalized Source Bundle

The connector should produce a bounded source bundle for Absorb.

Recommended shape:

```typescript
interface NormalizedSourceBundle {
  connector: "notion";
  selector: {
    kind: "page" | "data-source" | "query";
    value: string;
  };
  fetchedAt: string;
  documents: Array<{
    id: string;
    title: string;
    url?: string;
    createdTime?: string;
    lastEditedTime?: string;
    parent?: string;
    properties?: Record<string, unknown>;
    text: string;
    omittedBlocks?: Array<{
      blockId: string;
      type: string;
      reason: string;
    }>;
  }>;
}
```

The bundle should be written into the run context, a temporary run artifact, or another non-source-controlled location. It should not create raw permanent Notion dumps inside `.almanac/`.

## Prompt Requirements

The Absorb prompt or connector-specific source guidance must include this behavior:

```text
Treat Notion content as source evidence, not as output.

Do not summarize the Notion source.
Do not mirror the Notion hierarchy by default.
Do not copy private notes wholesale.

Extract only information that improves the Almanac wiki for future project work:
decisions, product rationale, user research conclusions, workflows, constraints,
gotchas, terminology, incidents, open questions, and cross-links between human
context and code behavior.

Prefer updating existing pages over creating new pages.
When a claim touches implementation, verify it against the codebase.
Keep Notion URLs, object IDs, and edit timestamps as provenance where useful.
No-op if the source is personal, transient, duplicative, or not useful for future
coding sessions.
```

The prompt should encourage synthesis between Notion and code:

```text
If Notion explains why a code path exists, update or create the page about that
code path, decision, or product flow. If code contradicts Notion, trust code for
current implementation and preserve Notion only as historical rationale when
that history is useful.
```

## Privacy and Safety

Notion may contain personal, private, or irrelevant content. The feature must be conservative by default.

Requirements:

- Never store access tokens in wiki files, git-tracked docs, run prompts shown in logs, or generated pages.
- Do not ingest an entire workspace by default.
- When no selector is provided, treat the run as bounded discovery plus selective absorption, not whole-workspace import.
- Apply default limits to query and data source ingest.
- Apply default limits to broad `almanac ingest notion` runs.
- Include source provenance without copying full raw pages into the wiki.
- No-op when content is not project-relevant.
- Avoid copying sensitive personal content unless it is explicitly project-relevant and necessary for future work.

## Error Handling

Errors should name the actionable cause.

Examples:

- Missing auth: `run: almanac connect notion`
- Missing permission: ask the user to share the page/data source with the Notion connection
- Invalid selector: explain accepted Notion URL or ID shapes
- Rate limit: retry with backoff where reasonable, otherwise preserve a resumable run summary
- Unsupported block: mark the block as omitted in source bundle metadata
- Oversized source: require a narrower selector or an explicit confirmation flag

## Non-Goals

The initial feature does not need to:

- mirror a whole Notion workspace
- keep continuous two-way sync with Notion
- write Almanac wiki pages back into Notion
- expose Notion as a live search dependency for normal `almanac search`
- preserve Notion's page tree as wiki topology
- create a vector database before lexical/source-guided ingest is proven insufficient

## Implementation Path

1. Define the connector abstraction and a Notion connector module.
2. Add Composio-backed Notion auth for `almanac connect notion`.
3. Store the Composio connected-account reference locally without storing Notion tokens.
4. Add `almanac connectors status` and `almanac disconnect notion`.
5. Add `almanac ingest notion --page <url-or-id>`.
6. Add broad bounded discovery for `almanac ingest notion`.
7. Fetch Notion page metadata and recursive block children.
8. Normalize the source bundle.
9. Pass the source bundle into the existing Absorb operation.
10. Add Notion-specific Absorb source guidance.
11. Add data source and query selectors after page ingest and broad ingest work.
12. Add direct Notion token/OAuth adapters only after the connector interface is stable.

## Autonomous Implementation Boundary

An agent can implement the Almanac side of the Composio-backed Notion connector without a human present:

- command registration for `almanac connect notion`
- Composio link-session API client
- local connection reference storage
- `almanac connectors status`
- `almanac disconnect notion`
- Notion ingest command routing
- source bundle normalization
- Absorb prompt/source guidance
- mocked tests for successful connect, missing auth, failed auth, status, disconnect, and ingest handoff

An agent should not claim that the live Notion connection is fully verified until a human completes the browser authorization step. The real `almanac connect notion` flow requires the user to open or approve the Notion authorization page, select or share pages as needed, and return through the Composio link session. If a Composio API key, auth config, or live Notion approval is missing, the implementation can still be complete against mocked tests but the live acceptance test remains pending.

The overnight implementation target is:

```text
`almanac connect notion` is implemented enough that a user can run it, complete
the browser authorization flow, and have Almanac store the resulting Composio
connected-account reference.
```

## Verification

The feature is done when these behaviors can be demonstrated.

### Unit Tests

- URL and ID parsing accepts common Notion page URLs and raw UUIDs.
- Secret values are redacted from run specs, logs, and rendered errors.
- Block normalization converts supported Notion block types into deterministic text.
- Unsupported blocks are represented as omissions with block ID, type, and reason.
- Data source pagination stops at configured limits.
- Query result pagination stops at configured limits.
- Broad Notion ingest discovery stops at configured candidate and full-fetch limits.
- Connector errors map to actionable CLI messages.

### Integration Tests With Mocked Notion API

- `almanac ingest notion --page <id>` fetches page metadata, block children, nested child blocks, and starts an Absorb run with a Notion source bundle.
- `almanac ingest notion` discovers accessible Notion candidates, fully fetches only a bounded selected set, and starts an Absorb run with provenance.
- Missing auth returns a `needs-action` outcome that points to `almanac connect notion`.
- A 403 or object-not-found response explains that the page may not be shared with the Notion connection.
- Oversized source selection exits without partial wiki writes unless explicitly confirmed.
- The Absorb run receives provenance fields for each source document.

### Prompt/Behavior Tests

Given a Notion page that contains raw meeting notes and a product decision, the resulting wiki update should capture the decision and rationale, not the meeting transcript.

Given a Notion page that duplicates an existing wiki page, the writer should update the existing page or no-op instead of creating a duplicate.

Given a Notion page that claims a code path behaves one way while code shows another, the writer should trust the code for current behavior and preserve the Notion claim only as historical context if useful.

Given a personal or transient Notion note, the writer should no-op.

### Manual Acceptance Test

1. Create or choose a Notion page with a project decision that references a code feature.
2. Connect Notion.
3. Run:

   ```bash
   almanac ingest notion --foreground
   ```

4. Verify that `.almanac/pages/` contains either an updated existing page or a new page about the durable project concept.
5. Verify that the page does not copy the Notion page wholesale.
6. Verify that the page cites the Notion URL or object ID as provenance.
7. Verify that implementation claims were checked against repo files where applicable.
8. Run:

   ```bash
   almanac health
   almanac search "notion-derived concept"
   ```

9. Verify that the wiki remains healthy and the new knowledge is discoverable.

## Research Sources

- Notion API overview: https://developers.notion.com/guides/get-started/overview
- Notion authorization guide: https://developers.notion.com/guides/get-started/authorization
- Notion search endpoint: https://developers.notion.com/reference/post-search
- Notion page content guide: https://developers.notion.com/guides/data-apis/working-with-page-content
- Notion data source guide: https://developers.notion.com/guides/data-apis/working-with-databases
- Composio Notion toolkit: https://docs.composio.dev/toolkits/notion
- Composio Notion auth guide: https://composio.dev/auth/notion
- Composio OAuth migration changelog: https://docs.composio.dev/docs/changelog

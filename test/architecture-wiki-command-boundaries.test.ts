import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries: wiki commands and viewer", () => {
  it("keeps wiki command target resolution in wiki services, not indexer stores", async () => {
    const wikiRootService = await readSource("src/services/wiki/wiki-root.ts");
    const searchService = await readSource("src/services/wiki/search.ts");
    const pageViewService = await readSource("src/services/wiki/page-view.ts");
    const healthService = await readSource("src/services/wiki/health.ts");
    const reindexService = await readSource("src/services/wiki/reindex.ts");

    expect(existsSync(join(ROOT, "src/services/wiki/wiki-root.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/resolve-wiki.ts")))
      .toBe(false);
    expect(wikiRootService).toContain("resolveWikiRoot");
    expect(wikiRootService).toContain("findNearestAlmanacDir");
    expect(wikiRootService).toContain("findEntry");
    expect(wikiRootService).toContain("isRegistryEntryWikiRoot");
    expect(wikiRootService).toContain("UserFacingError");
    expect(wikiRootService).not.toContain("openIndex");
    expect(wikiRootService).not.toContain("db.prepare");
    for (const source of [
      searchService,
      pageViewService,
      healthService,
      reindexService,
    ]) {
      expect(source).toContain("./wiki-root.js");
      expect(source).not.toContain("stores/wiki/indexer/resolve-wiki");
    }
  });

  it("keeps search command adapters out of index storage mechanics", async () => {
    const searchCommand = await readSource("src/edges/cli/commands/search.ts");
    const searchRender = await readSource("src/edges/cli/commands/search-render.ts");
    const searchService = await readSource("src/services/wiki/search.ts");

    expect(existsSync(join(ROOT, "src/edges/cli/commands/search-render.ts"))).toBe(
      true,
    );
    expect(searchCommand).toContain("services/wiki/search.js");
    expect(searchCommand).toContain("./search-render.js");
    expect(searchCommand).not.toContain("stores/wiki/indexer");
    expect(searchCommand).not.toContain("openIndex");
    expect(searchCommand).not.toContain("resolveWikiRoot");
    expect(searchCommand).not.toContain(
      "SearchOptions extends SearchWikiPagesRequest",
    );
    expect(searchCommand).not.toContain("SearchResult = WikiSearchResult");
    expect(searchCommand).not.toContain("JSON.stringify");
    expect(searchCommand).not.toContain("BLUE");
    expect(searchCommand).not.toContain("RST");
    expect(searchCommand).toContain("color?: boolean");
    expect(searchCommand).not.toContain("# 0 results");
    expect(searchCommand).not.toContain("consider --limit");
    expect(searchRender).toContain("renderSearchResults");
    expect(searchRender).toContain("../../shared/ansi-theme.js");
    expect(searchRender).not.toContain("../../ansi.js");
    expect(searchRender).toContain("makeAnsiTheme(options.color === true)");
    expect(searchRender).toContain("formatSearchResult");
    expect(searchRender).toContain("buildStderr");
    expect(searchService).not.toContain("export type WikiSearchResult = query");
  });

  it("keeps show command adapters out of index storage mechanics", async () => {
    const showCommand = await readSource("src/edges/cli/commands/show/index.ts");
    const showRender = await readSource("src/edges/cli/commands/show/render.ts");
    const showTypes = await readSource("src/edges/cli/commands/show/types.ts");
    const pageViewService = await readSource("src/services/wiki/page-view.ts");

    expect(existsSync(join(ROOT, "src/edges/cli/commands/show/render.ts"))).toBe(
      true,
    );
    expect(showCommand).toContain("services/wiki/page-view.js");
    expect(showCommand).toContain("./render.js");
    expect(showCommand).not.toContain("stores/wiki/indexer");
    expect(showCommand).not.toContain("openIndex");
    expect(showCommand).not.toContain("resolveWikiRoot");
    expect(showCommand).not.toContain("show requires a slug");
    expect(showCommand).not.toContain("no such page");
    expect(showCommand).not.toContain("formatShowRecords");
    expect(showTypes).toContain("color?: boolean");
    expect(showRender).toContain("formatShowRecords");
    expect(showRender).not.toContain("ansi");
    const showFormat = await readSource("src/edges/cli/commands/show/format.ts");
    expect(showFormat).toContain("../../../shared/ansi-theme.js");
    expect(showFormat).not.toContain("../../../ansi.js");
    expect(showFormat).toContain("makeAnsiTheme(options.color === true)");
    expect(showRender).toContain("renderShowResult");
    expect(showTypes).not.toContain("WikiPageView");
    expect(showTypes).not.toContain("ShowRecord =");
    expect(pageViewService).not.toContain("export type WikiPageView = query");
  });

  it("keeps health command adapters out of index storage mechanics", async () => {
    const healthCommand = await readSource("src/edges/cli/commands/health/index.ts");
    const healthRender = await readSource("src/edges/cli/commands/health/render.ts");
    const healthService = await readSource("src/services/wiki/health.ts");

    expect(existsSync(join(ROOT, "src/edges/cli/commands/health/render.ts"))).toBe(
      true,
    );
    expect(healthCommand).toContain("services/wiki/health.js");
    expect(healthCommand).toContain("./render.js");
    expect(healthCommand).not.toContain("stores/wiki/indexer");
    expect(healthCommand).not.toContain("../../../stores/wiki/health");
    expect(healthCommand).not.toContain("collectHealthReport");
    expect(healthCommand).not.toContain("resolveWikiRoot");
    expect(healthCommand).not.toContain("JSON.stringify");
    expect(healthCommand).not.toContain("BLUE");
    expect(healthCommand).toContain("color?: boolean");
    expect(healthCommand).not.toContain("legacy source frontmatter");
    expect(healthRender).toContain("../../../shared/ansi-theme.js");
    expect(healthRender).not.toContain("../../../ansi.js");
    expect(healthRender).toContain("makeAnsiTheme(options.color === true)");
    expect(healthRender).toContain("renderHealthReport");
    expect(healthRender).toContain("migrationWarning");
    expect(healthService).not.toContain("WikiHealthReport = HealthReport");
    expect(healthService).toContain("wikiHealthReportFromIndexerReport");
  });

  it("keeps wiki health report composition separate from individual checks", async () => {
    const healthIndex = await readSource("src/stores/wiki/health/index.ts");
    const linkChecks = await readSource("src/stores/wiki/health/link-checks.ts");
    const healthService = await readSource("src/services/wiki/health.ts");

    expect(existsSync(join(ROOT, "src/wiki"))).toBe(false);
    expect(existsSync(join(ROOT, "src/stores/wiki"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/health/page-checks.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/health/link-checks.ts"))).toBe(true);
    expect(healthIndex).toContain("page-checks.js");
    expect(healthIndex).toContain("link-checks.js");
    expect(healthIndex).not.toContain("SELECT p.slug FROM pages p");
    expect(healthIndex).not.toContain("SELECT w.source_slug");
    expect(healthIndex).not.toContain("fast-glob");
    expect(healthIndex).not.toContain("findEntry");
    expect(linkChecks).toContain("findCrossWikiLinks");
    expect(linkChecks).not.toContain("wiki-registry");
    expect(linkChecks).not.toContain("findEntry");
    expect(linkChecks).not.toContain("isRegistryEntryWikiRoot");
    expect(healthService).toContain("brokenCrossWikiLinks");
    expect(healthService).toContain("findEntry");
    expect(healthService).toContain("isRegistryEntryWikiRoot");
  });

  it("keeps reindex command adapters out of index storage mechanics", async () => {
    const reindexCommand = await readSource("src/edges/cli/commands/reindex.ts");
    const reindexRender = await readSource("src/edges/cli/commands/reindex-render.ts");
    const reindexService = await readSource("src/services/wiki/reindex.ts");

    expect(existsSync(join(ROOT, "src/edges/cli/commands/reindex-render.ts"))).toBe(
      true,
    );
    expect(reindexCommand).toContain("services/wiki/reindex.js");
    expect(reindexCommand).toContain("./reindex-render.js");
    expect(reindexCommand).not.toContain("stores/wiki/indexer");
    expect(reindexCommand).not.toContain("runIndexer");
    expect(reindexCommand).not.toContain("resolveWikiRoot");
    expect(reindexCommand).not.toContain("reindexed:");
    expect(reindexCommand).not.toContain("filesSkipped > 0");
    expect(reindexCommand).not.toContain(
      "ReindexOptions = ReindexWikiRequest",
    );
    expect(reindexCommand).not.toContain("result: ReindexWikiResult;");
    expect(reindexCommand).not.toContain("total:");
    expect(reindexRender).toContain("reindexed:");
    expect(reindexRender).not.toContain("services/wiki/reindex.js");
    expect(reindexRender).not.toContain("stores/wiki/indexer");
    expect(reindexService).not.toContain("export type ReindexWikiResult = IndexResult");
    expect(reindexService).not.toContain("total:");
  });

  it("keeps serve startup rendering out of server lifetime control", async () => {
    const serveEdge = await readSource("src/edges/cli/serve.ts");
    const serveRender = await readSource("src/edges/cli/serve-render.ts");
    const viewerServer = await readSource("src/edges/viewer/server.ts");
    const viewerReadModel = await readSource("src/edges/viewer/read-model/api.ts");
    const viewerOverviewQuery = await readSource("src/stores/wiki/query/overview.ts");
    const topicsYamlStore = await readSource("src/stores/wiki/topics/yaml.ts");
    const viewerGlobalReadModel = await readSource(
      "src/edges/viewer/read-model/global-api.ts",
    );
    const viewerJobs = await readSource("src/edges/viewer/read-model/jobs.ts");
    const cliInterrupt = await readSource("src/edges/cli/interrupt.ts");
    const registerQueryCommands = await readSource(
      "src/edges/cli/register-query-commands.ts",
    );
    const registerServeCommand = await readSource(
      "src/edges/cli/register-serve-command.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/commands/serve.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/serve-render.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/serve.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/serve-render.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/register-serve-command.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/interrupt.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/viewer/server.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/viewer/read-model/api.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/viewer"))).toBe(false);
    expect(existsSync(join(ROOT, "src/viewer/server.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/viewer/api.ts"))).toBe(false);
    expect(serveEdge).toContain("../viewer/server.js");
    expect(serveEdge).toContain("./serve-render.js");
    expect(serveEdge).toContain("waitForStop");
    expect(serveEdge).not.toContain("process.stdout");
    expect(serveEdge).not.toContain("process.once");
    expect(serveEdge).not.toContain("SIGINT");
    expect(serveEdge).not.toContain("almanac console:");
    expect(serveEdge).not.toContain("Press Ctrl+C");
    expect(serveRender).toContain("almanac console:");
    expect(serveRender).toContain("Press Ctrl+C");
    expect(viewerServer).not.toContain("process.once");
    expect(viewerServer).not.toContain("process.off");
    expect(viewerServer).not.toContain("SIGINT");
    expect(viewerServer).not.toContain("SIGTERM");
    expect(viewerServer).toContain("platform/process.js");
    expect(viewerServer).toContain("./read-model/global-api.js");
    expect(viewerServer).not.toContain("services/viewer");
    expect(viewerReadModel).not.toContain("node:http");
    expect(viewerReadModel).not.toContain("node:fs");
    expect(viewerReadModel).not.toContain("existsSync");
    expect(viewerReadModel).not.toContain("SELECT COUNT(*) FROM pages");
    expect(viewerReadModel).not.toContain("db.prepare");
    expect(viewerReadModel).toContain("wikiOverviewCounts");
    expect(viewerReadModel).toContain("hasTopicsFile");
    expect(viewerOverviewQuery).toContain("SELECT COUNT(*) FROM pages");
    expect(topicsYamlStore).toContain("hasTopicsFile");
    expect(topicsYamlStore).toContain("existsSync");
    expect(viewerReadModel).not.toContain("readViewerAsset");
    expect(viewerGlobalReadModel).toContain("services/wiki/registry.js");
    expect(viewerGlobalReadModel).toContain("listBrowseableWikis");
    expect(viewerGlobalReadModel).toContain("getBrowseableWiki");
    expect(viewerGlobalReadModel).not.toContain("stores/wiki-registry");
    expect(viewerGlobalReadModel).not.toContain("readRegistry");
    expect(viewerGlobalReadModel).not.toContain("existsSync");
    expect(viewerGlobalReadModel).not.toContain("node:fs");
    expect(viewerJobs).not.toContain("platform/process");
    expect(cliInterrupt).toContain("process.once");
    expect(cliInterrupt).toContain("SIGINT");
    expect(registerQueryCommands).toContain("registerServeCommand");
    expect(registerQueryCommands).not.toContain("waitForCliInterrupt");
    expect(registerQueryCommands).not.toContain("write: (chunk)");
    expect(registerServeCommand).toContain("waitForCliInterrupt");
    expect(registerServeCommand).toContain("./serve.js");
    expect(registerServeCommand).toContain("write: (chunk)");
  });

  it("keeps list command adapters out of registry storage mechanics", async () => {
    const listCommand = await readSource("src/edges/cli/commands/list.ts");
    const listRender = await readSource("src/edges/cli/commands/list-render.ts");
    const registerQuery = await readSource(
      "src/edges/cli/register-query-commands.ts",
    );
    const registerListCommand = await readSource(
      "src/edges/cli/register-list-command.ts",
    );
    const registryService = await readSource("src/services/wiki/registry.ts");
    const registryStore = await readSource("src/stores/wiki-registry/store.ts");

    expect(existsSync(join(ROOT, "src/edges/cli/commands/list-render.ts"))).toBe(true);
    expect(listCommand).toContain("services/wiki/registry.js");
    expect(listCommand).toContain("./list-render.js");
    expect(listCommand).not.toContain("../../stores/wiki/registry");
    expect(listCommand).not.toContain("readRegistry");
    expect(listCommand).not.toContain("dropEntry");
    expect(listCommand).not.toContain("existsSync");
    expect(listCommand).not.toContain("JSON.stringify");
    expect(listCommand).not.toContain("BLUE");
    expect(listCommand).not.toContain("BOLD");
    expect(listCommand).not.toContain("process.stdout");
    expect(listCommand).not.toContain("no wikis registered");
    expect(listCommand).not.toContain("removed \\\"");
    expect(listCommand).toContain("color?: boolean");
    expect(listRender).toContain("renderListWikis");
    expect(listRender).toContain("../../shared/ansi-theme.js");
    expect(listRender).not.toContain("../../ansi.js");
    expect(listRender).toContain("makeAnsiTheme(options.color === true)");
    expect(listRender).toContain("renderListDropResult");
    expect(listRender).toContain("formatPretty");
    expect(registerQuery).toContain("registerListCommand");
    expect(registerListCommand).toContain("shouldUseStdoutColor()");
    expect(registryService).not.toContain("export type RegisteredWiki = RegistryEntry");
    expect(registryService).toContain("isRegistryEntryReachable");
    expect(registryService).toContain("isRegistryEntryWikiRoot");
    expect(registryService).toContain("listBrowseableWikis");
    expect(registryService).toContain("getBrowseableWiki");
    expect(registryService).not.toContain("existsSync");
    expect(registryService).not.toContain("node:fs");
    expect(registryStore).toContain("isRegistryEntryReachable");
    expect(registryStore).toContain("isRegistryEntryWikiRoot");
    expect(registryStore).toContain("existsSync");
  });

  it("keeps topic read command adapters out of index storage mechanics", async () => {
    const topicsListCommand = await readSource("src/edges/cli/commands/topics/list.ts");
    const topicsShowCommand = await readSource("src/edges/cli/commands/topics/show.ts");
    const topicsReadRender = await readSource(
      "src/edges/cli/commands/topics/read-render.ts",
    );
    const topicsCommandTypes = await readSource(
      "src/edges/cli/commands/topics/types.ts",
    );
    const registerTopics = await readSource(
      "src/edges/cli/register-topics-commands.ts",
    );
    const registerTopicRead = await readSource(
      "src/edges/cli/register-topic-read-commands.ts",
    );
    const registerTopicCreate = await readSource(
      "src/edges/cli/register-topic-create-command.ts",
    );
    const registerTopicEdges = await readSource(
      "src/edges/cli/register-topic-edge-commands.ts",
    );
    const registerTopicMutations = await readSource(
      "src/edges/cli/register-topic-mutation-commands.ts",
    );
    const topicTypes = await readSource("src/services/wiki/topic-types.ts");
    const topicReadService = await readSource("src/services/wiki/topic-read.ts");
    const topicQueryStore = await readSource("src/stores/wiki/query/topics.ts");
    const topicWorkspace = await readSource(
      "src/services/wiki/topic-workspace.ts",
    );

    for (const source of [
      topicsListCommand,
      topicsShowCommand,
      topicsReadRender,
    ]) {
      expect(source).toContain("services/wiki/topics.js");
      expect(source).not.toContain("stores/wiki/indexer");
      expect(source).not.toContain("openIndex");
      expect(source).not.toContain("resolveWikiRoot");
    }
    expect(topicsReadRender).not.toContain("stores/wiki/topics/yaml");
    expect(topicsReadRender).not.toContain("titleCase");
    expect(topicsReadRender).toContain("../../../shared/ansi-theme.js");
    expect(topicsReadRender).not.toContain("../../../ansi.js");
    expect(topicsReadRender).toContain("makeAnsiTheme(options.color === true)");
    expect(registerTopics).toContain("registerTopicReadCommands(topics)");
    expect(registerTopics).toContain("registerTopicCreateCommand(topics)");
    expect(registerTopics).toContain("registerTopicEdgeCommands(topics)");
    expect(registerTopics).toContain("registerTopicMutationCommands(topics)");
    expect(registerTopics).not.toContain('.command("list"');
    expect(registerTopics).not.toContain(".command(\"show <slug>\")");
    expect(registerTopics).not.toContain(".command(\"create <name>\")");
    expect(registerTopics).not.toContain(".command(\"rename <old> <new>\")");
    expect(registerTopicRead).toContain("shouldUseStdoutColor()");
    expect(registerTopicRead).toContain('.command("list"');
    expect(registerTopicRead).toContain(".command(\"show <slug>\")");
    expect(registerTopicCreate).toContain(".command(\"create <name>\")");
    expect(registerTopicEdges).toContain(".command(\"link <child> <parent>\")");
    expect(registerTopicEdges).toContain(".command(\"unlink <child> <parent>\")");
    expect(registerTopicMutations).toContain(".command(\"rename <old> <new>\")");
    expect(registerTopicMutations).toContain(".command(\"delete <slug>\")");
    expect(registerTopicMutations).toContain(".command(\"describe <slug> <text>\")");
    expect(registerTopics).not.toContain("process.stdout.isTTY");
    expect(topicsCommandTypes).toContain("color?: boolean");
    expect(topicTypes).not.toContain("stores/wiki/query");
    expect(topicTypes).not.toContain("query.");
    expect(topicReadService).toContain("topicPageSlugs");
    expect(topicReadService).not.toContain("db.prepare");
    expect(topicReadService).not.toContain("SELECT pt.page_slug");
    expect(topicReadService).not.toContain("descendantsInDb");
    expect(topicQueryStore).toContain("export function topicPageSlugs");
    expect(topicQueryStore).toContain("export function topicExistsInDb");
    expect(topicQueryStore).toContain("SELECT pt.page_slug");
    expect(topicQueryStore).toContain("SELECT slug FROM topics WHERE slug = ?");
    expect(topicQueryStore).toContain("descendantsInDb");
    expect(topicWorkspace).not.toContain("db.prepare");
    expect(topicWorkspace).not.toContain("SELECT slug FROM topics");
    expect(topicWorkspace).toContain("topicExistsInDb");
    expect(topicTypes).not.toContain("WikiTopicRequest extends WikiTopicsRequest");
    expect(topicTypes).not.toContain(
      "DescribeWikiTopicRequest extends WikiTopicsRequest",
    );
    expect(topicTypes).not.toContain(
      "CreateWikiTopicRequest extends WikiTopicsRequest",
    );
    expect(topicTypes).not.toContain(
      "LinkWikiTopicsRequest extends WikiTopicsRequest",
    );
    expect(topicTypes).not.toContain(
      "UnlinkWikiTopicsRequest extends WikiTopicsRequest",
    );
    expect(topicTypes).not.toContain(
      "RenameWikiTopicRequest extends WikiTopicsRequest",
    );
    expect(topicTypes).not.toContain(
      "DeleteWikiTopicRequest extends WikiTopicsRequest",
    );
    expect(topicWorkspace).not.toContain(
      "EditableTopicWorkspace extends FreshTopicIndex",
    );
  });

  it("keeps topic command option contracts explicit per verb", async () => {
    const topicCommandTypes = await readSource(
      "src/edges/cli/commands/topics/types.ts",
    );
    const topicCommandIndex = await readSource(
      "src/edges/cli/commands/topics/index.ts",
    );

    expect(topicCommandTypes).not.toContain("TopicsBaseOptions");
    expect(topicCommandIndex).not.toContain("TopicsBaseOptions");
    expect(topicCommandTypes).not.toContain("extends TopicsBaseOptions");
    expect(topicCommandTypes).not.toContain(
      "TopicsUnlinkOptions extends TopicsLinkOptions",
    );
  });

  it("keeps service-backed topic mutation adapters out of write mechanics", async () => {
    const createCommand = await readSource("src/edges/cli/commands/topics/create.ts");
    const deleteCommand = await readSource("src/edges/cli/commands/topics/delete.ts");
    const describeCommand = await readSource("src/edges/cli/commands/topics/describe.ts");
    const linkCommand = await readSource("src/edges/cli/commands/topics/link.ts");
    const renameCommand = await readSource("src/edges/cli/commands/topics/rename.ts");
    const unlinkCommand = await readSource("src/edges/cli/commands/topics/unlink.ts");
    const mutationRender = await readSource(
      "src/edges/cli/commands/topics/mutation-render.ts",
    );
    const topicPageMutations = await readSource(
      "src/services/wiki/topic-page-mutations.ts",
    );
    const topicCreate = await readSource("src/services/wiki/topic-create.ts");
    const topicEdgeMutations = await readSource(
      "src/services/wiki/topic-edge-mutations.ts",
    );
    const topicPageRewrite = await readSource(
      "src/stores/wiki/topics/page-rewrite.ts",
    );

    for (const source of [
      createCommand,
      deleteCommand,
      describeCommand,
      linkCommand,
      renameCommand,
      unlinkCommand,
    ]) {
      expect(source).toContain("services/wiki/topics.js");
      expect(source).not.toContain("stores/wiki/indexer");
      expect(source).not.toContain("stores/wiki/topics/yaml");
      expect(source).not.toContain("runIndexer");
      expect(source).not.toContain("openFreshTopicsWorkspace");
    }

    for (const source of [
      createCommand,
      deleteCommand,
      describeCommand,
      linkCommand,
      renameCommand,
      unlinkCommand,
    ]) {
      expect(source).not.toContain("stdout:");
      expect(source).not.toContain("stderr:");
      expect(source).not.toContain("exitCode:");
      expect(source).not.toContain("almanac:");
    }

    expect(mutationRender).toContain("renderTopicsCreate");
    expect(mutationRender).toContain("renderTopicsDelete");
    expect(mutationRender).toContain("renderTopicsDescribe");
    expect(mutationRender).toContain("renderTopicsLink");
    expect(mutationRender).toContain("renderTopicsRename");
    expect(mutationRender).toContain("renderTopicsUnlink");
    expect(existsSync(join(ROOT, "src/edges/cli/commands/topics/workspace.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/topics/page-rewrite.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/wiki/topic-page-rewrite.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/wiki/topic-graph-mutations.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/stores/wiki/topics/page-rewrite.ts"))).toBe(true);
    expect(topicCreate).toContain("export async function createWikiTopic");
    expect(topicCreate).not.toContain("export async function linkWikiTopics");
    expect(topicCreate).not.toContain("export async function unlinkWikiTopics");
    expect(topicEdgeMutations).toContain("export async function linkWikiTopics");
    expect(topicEdgeMutations).toContain("export async function unlinkWikiTopics");
    expect(topicEdgeMutations).not.toContain("export async function createWikiTopic");
    expect(topicPageMutations).toContain("stores/wiki/topics/page-rewrite.js");
    expect(topicPageMutations).not.toContain("fast-glob");
    expect(topicPageMutations).not.toContain("readFile");
    expect(topicPageRewrite).toContain("fast-glob");
    expect(topicPageRewrite).toContain("readFile");
    expect(existsSync(join(ROOT, "src/services/wiki/topic-mutations.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/topics/read.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/topics/render.ts"))).toBe(false);
  });

  it("keeps topic frontmatter block splitting separate from topic rewrites", async () => {
    const frontmatterRewrite = await readSource(
      "src/stores/wiki/topics/frontmatter-rewrite.ts",
    );
    const frontmatterBlock = await readSource(
      "src/stores/wiki/topics/frontmatter-block.ts",
    );
    const frontmatterTopicList = await readSource(
      "src/stores/wiki/topics/frontmatter-topic-list.ts",
    );

    expect(existsSync(join(ROOT, "src/stores/wiki/topics/frontmatter-block.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/topics/frontmatter-topic-list.ts"))).toBe(true);
    expect(frontmatterRewrite).toContain("frontmatter-block.js");
    expect(frontmatterRewrite).toContain("frontmatter-topic-list.js");
    expect(frontmatterRewrite).not.toContain("function splitFrontmatter");
    expect(frontmatterRewrite).not.toContain("function readTopicsFromLines");
    expect(frontmatterRewrite).not.toContain("function stripTrailingComment");
    expect(frontmatterRewrite).not.toContain("raw.match(/^---");
    expect(frontmatterBlock).toContain("export function splitFrontmatter");
    expect(frontmatterTopicList).toContain("export function readTopicsFromLines");
  });

  it("keeps tag command adapters out of page topic write mechanics", async () => {
    const tagCommand = await readSource("src/edges/cli/commands/tag.ts");
    const tagRender = await readSource("src/edges/cli/commands/tag-render.ts");
    const pageTopicService = await readSource(
      "src/services/wiki/page-topic-mutations.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/commands/tag-render.ts"))).toBe(true);
    expect(tagCommand).toContain("services/wiki/page-topic-mutations.js");
    expect(tagCommand).not.toContain("stores/wiki/indexer");
    expect(tagCommand).not.toContain("stores/wiki/topics");
    expect(tagCommand).not.toContain("resolveWikiRoot");
    expect(tagCommand).not.toContain("openIndex");
    expect(tagCommand).not.toContain("runIndexer");
    expect(tagCommand).not.toContain("rewritePageTopics");
    expect(tagCommand).not.toContain("loadTopicsFile");
    expect(tagCommand).not.toContain("writeTopicsFile");
    expect(tagCommand).not.toContain("renderTaggedPages");
    expect(tagCommand).not.toContain("renderMissingPages");
    expect(tagCommand).not.toContain("no such page");
    expect(tagCommand).not.toContain("tag requires");
    expect(tagCommand).not.toContain("untagged");
    expect(tagRender).toContain("renderTagResult");
    expect(tagRender).toContain("renderUntagResult");

    expect(pageTopicService).not.toContain("SELECT file_path FROM pages");
    expect(pageTopicService).not.toContain("openIndex");
    expect(pageTopicService).not.toContain("indexDbPath");
  });

  it("keeps review command adapters out of review store mechanics", async () => {
    const reviewAddCommand = await readSource("src/edges/cli/commands/review/add.ts");
    const reviewReadCommand = await readSource("src/edges/cli/commands/review/read.ts");
    const reviewDecisionCommand = await readSource(
      "src/edges/cli/commands/review/decision.ts",
    );
    const reviewRender = await readSource("src/edges/cli/commands/review/render.ts");
    const reviewService = await readSource("src/services/wiki/reviews.ts");
    const reviewTypes = await readSource("src/services/wiki/review-types.ts");
    const reviewWorkspace = await readSource(
      "src/services/wiki/review-workspace.ts",
    );
    const reviewRegistration = await readSource(
      "src/edges/cli/register-review-commands.ts",
    );
    const reviewAddRegistration = await readSource(
      "src/edges/cli/register-review-add-command.ts",
    );
    const reviewReadRegistration = await readSource(
      "src/edges/cli/register-review-read-commands.ts",
    );
    const reviewDecisionRegistration = await readSource(
      "src/edges/cli/register-review-decision-commands.ts",
    );
    const reviewMarkdownInput = await readSource(
      "src/edges/cli/review-markdown-input.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/commands/review.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/review-render.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/review/add.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/review/read.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/review/decision.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/review/render.ts")))
      .toBe(true);
    expect(reviewRegistration).toContain("registerReviewAddCommand(review)");
    expect(reviewRegistration).toContain("registerReviewReadCommands(review)");
    expect(reviewRegistration).toContain("registerReviewDecisionCommands(review)");
    expect(reviewRegistration).not.toContain("readStdin");
    expect(reviewRegistration).not.toContain("markdownFromArgs");
    expect(reviewRegistration).not.toContain("runReviewAdd");
    expect(reviewRegistration).not.toContain("runReviewList");
    expect(reviewAddRegistration).toContain(".command(\"add [markdown...]\")");
    expect(reviewAddRegistration).toContain("reviewMarkdownInput(markdownArg)");
    expect(reviewReadRegistration).toContain('.command("list"');
    expect(reviewReadRegistration).toContain(".command(\"show <id>\")");
    expect(reviewDecisionRegistration).toContain("REVIEW_DECISION_COMMANDS");
    expect(reviewDecisionRegistration).toContain("runReviewDecide");
    expect(reviewDecisionRegistration).toContain("runReviewApply");
    expect(reviewDecisionRegistration).toContain("runReviewReopen");
    expect(reviewMarkdownInput).toContain("readStdin");
    expect(reviewMarkdownInput).toContain("markdownFromArgs");
    for (const reviewCommand of [
      reviewAddCommand,
      reviewReadCommand,
      reviewDecisionCommand,
    ]) {
      expect(reviewCommand).toContain("services/wiki/reviews.js");
      expect(reviewCommand).toContain("./render.js");
      expect(reviewCommand).not.toContain("review/store");
      expect(reviewCommand).not.toContain("stores/wiki-review");
      expect(reviewCommand).not.toContain("resolveWikiRoot");
      expect(reviewCommand).not.toContain("reviewYamlPath");
      expect(reviewCommand).not.toContain("loadReviewFile");
      expect(reviewCommand).not.toContain("writeReviewFile");
      expect(reviewCommand).not.toContain("nextReviewId");
      expect(reviewCommand).not.toContain("type ReviewItem");
      expect(reviewCommand).not.toContain("type ReviewStatus");
      expect(reviewCommand).not.toContain("ReviewCommandOutput = CommandResult");
      expect(reviewCommand).not.toContain("interface ReviewOptions");
      expect(reviewCommand).not.toContain("ReviewItemOptions extends ReviewOptions");
      expect(reviewCommand).not.toContain("renderOutcome");
      expect(reviewCommand).not.toContain("switch (result.status)");
      expect(reviewCommand).not.toContain("result.status ===");
      expect(reviewCommand).not.toContain("JSON.stringify");
      expect(reviewCommand).not.toContain(".trim()");
      expect(reviewCommand).not.toContain(".replace(/\\s+$/g");
      expect(reviewCommand).not.toContain("added review item:");
      expect(reviewCommand).not.toContain("Decision:");
      expect(reviewCommand).not.toContain(
        "options: { cwd: string; wiki?: string; id: string; json?: boolean }",
      );
    }
    expect(reviewReadCommand).toContain("interface ReviewShowOptions");
    expect(reviewAddCommand).toContain("renderReviewAddResult");
    expect(reviewRender).toContain("renderOutcome");
    expect(reviewRender).toContain("renderReviewAddResult");
    expect(reviewRender).toContain("switch (result.status)");
    expect(reviewRender).toContain("added review item:");
    expect(reviewRender).toContain("Decision:");

    expect(reviewService).not.toContain("resolveWikiRoot");
    expect(reviewService).not.toContain("reviewYamlPath");
    expect(reviewService).not.toContain("loadReviewFile");
    expect(reviewService).not.toContain("function isReviewStatusFilter");
    expect(reviewTypes).not.toContain("stores/wiki-review");
    expect(reviewTypes).not.toContain("StoredReview");
    expect(reviewTypes).not.toContain("export type {");
    expect(reviewTypes).not.toContain(
      "AddWikiReviewItemRequest extends WikiReviewRequest",
    );
    expect(reviewTypes).not.toContain(
      "ListWikiReviewItemsRequest extends WikiReviewRequest",
    );
    expect(reviewTypes).not.toContain(
      "WikiReviewItemRequest extends WikiReviewRequest",
    );
    expect(reviewTypes).not.toContain(
      "ChangeWikiReviewItemRequest extends WikiReviewItemRequest",
    );
    expect(reviewWorkspace).not.toContain(
      "FoundWikiReviewItem extends OpenWikiReviewFile",
    );
    expect(reviewWorkspace).not.toContain("{ ...opened, item }");
  });

  it("keeps wiki review store I/O separate from YAML codec concerns", async () => {
    const reviewStore = await readSource("src/stores/wiki-review/store.ts");
    const reviewCodec = await readSource("src/stores/wiki-review/codec.ts");

    expect(existsSync(join(ROOT, "src/stores/wiki-review/codec.ts"))).toBe(true);
    expect(reviewStore).toContain("parseReviewFile");
    expect(reviewStore).toContain("serializeReviewFile");
    expect(reviewStore).not.toContain("js-yaml");
    expect(reviewStore).not.toContain("normalizeReviewItem");
    expect(reviewStore).not.toContain("requiredStatus");
    expect(reviewStore).not.toContain("review.yaml at");
    expect(reviewCodec).toContain("js-yaml");
    expect(reviewCodec).toContain("normalizeReviewItem");
    expect(reviewCodec).toContain("serializeReviewFile");
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}

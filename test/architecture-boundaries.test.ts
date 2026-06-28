import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries", () => {
  it("keeps wiki initialization inside service and store ownership", async () => {
    const initialization = await readSource("src/services/wiki/initialization.ts");
    const fileScaffold = await readSource("src/stores/wiki-files/scaffold.ts");
    const filePages = await readSource("src/stores/wiki-files/pages.ts");
    const pageSnapshots = await readSource(
      "src/stores/wiki-files/page-snapshots.ts",
    );
    const buildOperation = await readSource(
      "src/services/lifecycle/operations/build.ts",
    );

    expect(existsSync(join(ROOT, "src/init"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/wiki/initialization.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/stores/wiki-files/scaffold.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/stores/wiki-files/pages.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki-files/page-snapshots.ts"))).toBe(
      true,
    );
    expect(initialization).toContain("scaffoldWikiFiles");
    expect(initialization).toContain("addEntry");
    expect(initialization).not.toContain("writeFile");
    expect(initialization).not.toContain("mkdir");
    expect(fileScaffold).toContain("writeFile");
    expect(fileScaffold).toContain("mkdir");
    expect(fileScaffold).not.toContain("addEntry");
    expect(filePages).toContain("readdir");
    expect(filePages).toContain("countWikiPageFiles");
    expect(pageSnapshots).toContain("readFile");
    expect(pageSnapshots).toContain("snapshotWikiPages");
    expect(buildOperation).toContain("from \"../../wiki/initialization.js\"");
    expect(buildOperation).toContain("countWikiPageFiles");
    expect(buildOperation).not.toContain("node:fs");
    expect(buildOperation).not.toContain("readdir");
    expect(buildOperation).not.toContain("init/scaffold");
  });

  it("keeps src/cli.ts as a stable facade over the CLI edge runner", async () => {
    const facade = await readSource("src/cli.ts");

    expect(facade).toContain("from \"./edges/cli/run.js\"");
    expect(facade).not.toContain("from \"commander\"");
    expect(facade).not.toContain("cli/commands");
    expect(facade).not.toContain("platform/");
    expect(facade).not.toContain("jobs/");
  });

  it("keeps process-level CLI machinery inside the CLI edge", async () => {
    const runner = await readSource("src/edges/cli/run.ts");
    const help = await readSource("src/edges/cli/help.ts");
    const updateAnnounce = await readSource("src/platform/update/announce.ts");

    expect(existsSync(join(ROOT, "src/ansi.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/ansi-theme.ts"))).toBe(true);
    expect(runner).toContain("from \"commander\"");
    expect(runner).toContain("tryRunInternalJob");
    expect(runner).toContain("readPackageVersion");
    expect(help).toContain("../../ansi-theme.js");
    expect(help).not.toContain("../../ansi.js");
    expect(help).toContain("shouldUseStdoutColor()");
    expect(updateAnnounce).toContain("../../ansi-theme.js");
    expect(updateAnnounce).not.toContain("process.stderr.isTTY");
    expect(updateAnnounce).not.toContain("\\x1b[");
  });

  it("keeps CLI registration and shortcut parsing in the CLI edge", () => {
    const oldCliShellFiles = [
      "src/cli/help.ts",
      "src/cli/sqlite-free.ts",
      "src/cli/register-commands.ts",
      "src/cli/register-query-commands.ts",
      "src/cli/register-edit-commands.ts",
      "src/cli/register-setup-commands.ts",
      "src/cli/register-wiki-lifecycle-commands.ts",
      "src/edges/cli/register-wiki-lifecycle-commands.ts",
    ];

    for (const path of oldCliShellFiles) {
      expect(existsSync(join(ROOT, path)), path).toBe(false);
    }
  });

  it("keeps CLI command-family registration split by product surface", async () => {
    const registerCommands = await readSource(
      "src/edges/cli/register-commands.ts",
    );
    const registerSetup = await readSource(
      "src/edges/cli/register-setup-commands.ts",
    );
    const registerAgents = await readSource(
      "src/edges/cli/register-agent-commands.ts",
    );
    const registerConfig = await readSource(
      "src/edges/cli/register-config-commands.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/register-agent-commands.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/register-config-commands.ts")))
      .toBe(true);
    expect(registerCommands).toContain("registerAgentCommands(program)");
    expect(registerCommands).toContain("registerConfigCommands(program)");
    expect(registerSetup).not.toContain(".command(\"agents\")");
    expect(registerSetup).not.toContain(".command(\"config\")");
    expect(registerAgents).toContain(".command(\"agents\")");
    expect(registerConfig).toContain(".command(\"config\")");
  });

  it("keeps ordinary command-result emission centralized in the CLI edge helper", async () => {
    const edgeHelpers = await readSource("src/edges/cli/helpers.ts");
    const outcome = await readSource("src/cli/outcome.ts");
    const registerMaintenance = await readSource(
      "src/edges/cli/register-maintenance-commands.ts",
    );
    const registerQuery = await readSource(
      "src/edges/cli/register-query-commands.ts",
    );

    expect(edgeHelpers).toContain("export function emit");
    expect(edgeHelpers).toContain("process.stdout.write");
    expect(edgeHelpers).toContain("process.stderr.write");
    expect(outcome).toContain("export interface CommandResult");
    expect(existsSync(join(ROOT, "src/cli/helpers.ts"))).toBe(false);

    expect(registerMaintenance).toContain("from \"./helpers.js\"");
    expect(registerMaintenance).toContain("emitCliWarning");
    expect(registerMaintenance).toContain("emit(result)");
    expect(registerMaintenance).not.toContain("process.stdout.write");
    expect(registerMaintenance).not.toContain("process.exitCode");

    expect(registerQuery).toContain("from \"./helpers.js\"");
    expect(registerQuery).toContain("const result = await listWikis({");
    expect(registerQuery).toContain("color: shouldUseStdoutColor()");
    expect(registerQuery).toContain("emit(result)");
    expect(registerQuery).not.toContain("process.stdout.write(result.stdout)");
    expect(registerQuery).not.toContain("process.exitCode = result.exitCode");
  });

  it("keeps lifecycle command rendering out of workflow adapters", async () => {
    const operationsCommand = await readSource("src/cli/commands/operations.ts");
    const operationsRender = await readSource(
      "src/cli/commands/operations-render.ts",
    );

    expect(existsSync(join(ROOT, "src/cli/commands/operations-render.ts")))
      .toBe(true);
    expect(operationsCommand).toContain("runInitOperationWorkflow");
    expect(operationsCommand).toContain("renderWorkflowResult");
    expect(operationsCommand).not.toContain("renderOutcome");
    expect(operationsCommand).not.toContain("renderError");
    expect(operationsCommand).not.toContain("Reason:");
    expect(operationsCommand).not.toContain("Browse the wiki");
    expect(operationsRender).toContain("renderOutcome");
    expect(operationsRender).toContain("renderOperationFailureMessage");
  });

  it("keeps search command adapters out of index storage mechanics", async () => {
    const searchCommand = await readSource("src/cli/commands/search.ts");
    const searchRender = await readSource("src/cli/commands/search-render.ts");
    const searchService = await readSource("src/services/wiki/search.ts");

    expect(existsSync(join(ROOT, "src/cli/commands/search-render.ts"))).toBe(
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
    expect(searchRender).toContain("../../ansi-theme.js");
    expect(searchRender).not.toContain("../../ansi.js");
    expect(searchRender).toContain("makeAnsiTheme(options.color === true)");
    expect(searchRender).toContain("formatSearchResult");
    expect(searchRender).toContain("buildStderr");
    expect(searchService).not.toContain("export type WikiSearchResult = query");
  });

  it("keeps show command adapters out of index storage mechanics", async () => {
    const showCommand = await readSource("src/cli/commands/show/index.ts");
    const showRender = await readSource("src/cli/commands/show/render.ts");
    const showTypes = await readSource("src/cli/commands/show/types.ts");
    const pageViewService = await readSource("src/services/wiki/page-view.ts");

    expect(existsSync(join(ROOT, "src/cli/commands/show/render.ts"))).toBe(
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
    const showFormat = await readSource("src/cli/commands/show/format.ts");
    expect(showFormat).toContain("../../../ansi-theme.js");
    expect(showFormat).not.toContain("../../../ansi.js");
    expect(showFormat).toContain("makeAnsiTheme(options.color === true)");
    expect(showRender).toContain("renderShowResult");
    expect(showTypes).not.toContain("WikiPageView");
    expect(showTypes).not.toContain("ShowRecord =");
    expect(pageViewService).not.toContain("export type WikiPageView = query");
  });

  it("keeps health command adapters out of index storage mechanics", async () => {
    const healthCommand = await readSource("src/cli/commands/health/index.ts");
    const healthRender = await readSource("src/cli/commands/health/render.ts");
    const healthService = await readSource("src/services/wiki/health.ts");

    expect(existsSync(join(ROOT, "src/cli/commands/health/render.ts"))).toBe(
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
    expect(healthRender).toContain("../../../ansi-theme.js");
    expect(healthRender).not.toContain("../../../ansi.js");
    expect(healthRender).toContain("makeAnsiTheme(options.color === true)");
    expect(healthRender).toContain("renderHealthReport");
    expect(healthRender).toContain("migrationWarning");
    expect(healthService).not.toContain("WikiHealthReport = HealthReport");
    expect(healthService).toContain("wikiHealthReportFromIndexerReport");
  });

  it("keeps wiki health report composition separate from individual checks", async () => {
    const healthIndex = await readSource("src/stores/wiki/health/index.ts");

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
  });

  it("keeps reindex command adapters out of index storage mechanics", async () => {
    const reindexCommand = await readSource("src/cli/commands/reindex.ts");
    const reindexRender = await readSource("src/cli/commands/reindex-render.ts");
    const reindexService = await readSource("src/services/wiki/reindex.ts");

    expect(existsSync(join(ROOT, "src/cli/commands/reindex-render.ts"))).toBe(
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
    expect(reindexRender).toContain("reindexed:");
    expect(reindexRender).not.toContain("services/wiki/reindex.js");
    expect(reindexRender).not.toContain("stores/wiki/indexer");
    expect(reindexService).not.toContain("export type ReindexWikiResult = IndexResult");
  });

  it("keeps serve startup rendering out of server lifetime control", async () => {
    const serveEdge = await readSource("src/edges/cli/serve.ts");
    const serveRender = await readSource("src/edges/cli/serve-render.ts");
    const viewerServer = await readSource("src/edges/viewer/server.ts");
    const viewerReadModel = await readSource("src/edges/viewer/read-model/api.ts");
    const viewerJobs = await readSource("src/edges/viewer/read-model/jobs.ts");
    const cliInterrupt = await readSource("src/edges/cli/interrupt.ts");
    const registerQueryCommands = await readSource(
      "src/edges/cli/register-query-commands.ts",
    );

    expect(existsSync(join(ROOT, "src/cli/commands/serve.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/serve-render.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/serve.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/serve-render.ts"))).toBe(true);
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
    expect(viewerReadModel).not.toContain("readViewerAsset");
    expect(viewerJobs).not.toContain("platform/process");
    expect(cliInterrupt).toContain("process.once");
    expect(cliInterrupt).toContain("SIGINT");
    expect(registerQueryCommands).toContain("waitForCliInterrupt");
    expect(registerQueryCommands).toContain("./serve.js");
    expect(registerQueryCommands).toContain("write: (chunk)");
  });

  it("keeps list command adapters out of registry storage mechanics", async () => {
    const listCommand = await readSource("src/cli/commands/list.ts");
    const listRender = await readSource("src/cli/commands/list-render.ts");
    const registerQuery = await readSource(
      "src/edges/cli/register-query-commands.ts",
    );
    const registryService = await readSource("src/services/wiki/registry.ts");
    const registryStore = await readSource("src/stores/wiki-registry/store.ts");

    expect(existsSync(join(ROOT, "src/cli/commands/list-render.ts"))).toBe(true);
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
    expect(listRender).toContain("../../ansi-theme.js");
    expect(listRender).not.toContain("../../ansi.js");
    expect(listRender).toContain("makeAnsiTheme(options.color === true)");
    expect(listRender).toContain("renderListDropResult");
    expect(listRender).toContain("formatPretty");
    expect(registerQuery).toContain("shouldUseStdoutColor()");
    expect(registryService).not.toContain("export type RegisteredWiki = RegistryEntry");
    expect(registryService).toContain("isRegistryEntryReachable");
    expect(registryService).not.toContain("existsSync");
    expect(registryService).not.toContain("node:fs");
    expect(registryStore).toContain("isRegistryEntryReachable");
    expect(registryStore).toContain("existsSync");
  });

  it("keeps topic read command adapters out of index storage mechanics", async () => {
    const topicsListCommand = await readSource("src/cli/commands/topics/list.ts");
    const topicsShowCommand = await readSource("src/cli/commands/topics/show.ts");
    const topicsReadRender = await readSource(
      "src/cli/commands/topics/read-render.ts",
    );
    const topicsCommandTypes = await readSource(
      "src/cli/commands/topics/types.ts",
    );
    const registerTopics = await readSource(
      "src/edges/cli/register-topics-commands.ts",
    );
    const topicTypes = await readSource("src/services/wiki/topic-types.ts");
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
    expect(topicsReadRender).toContain("../../../ansi-theme.js");
    expect(topicsReadRender).not.toContain("../../../ansi.js");
    expect(topicsReadRender).toContain("makeAnsiTheme(options.color === true)");
    expect(registerTopics).toContain("shouldUseStdoutColor()");
    expect(registerTopics).not.toContain("process.stdout.isTTY");
    expect(topicsCommandTypes).toContain("color?: boolean");
    expect(topicTypes).not.toContain("stores/wiki/query");
    expect(topicTypes).not.toContain("query.");
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
      "src/cli/commands/topics/types.ts",
    );
    const topicCommandIndex = await readSource(
      "src/cli/commands/topics/index.ts",
    );

    expect(topicCommandTypes).not.toContain("TopicsBaseOptions");
    expect(topicCommandIndex).not.toContain("TopicsBaseOptions");
    expect(topicCommandTypes).not.toContain("extends TopicsBaseOptions");
    expect(topicCommandTypes).not.toContain(
      "TopicsUnlinkOptions extends TopicsLinkOptions",
    );
  });

  it("keeps service-backed topic mutation adapters out of write mechanics", async () => {
    const createCommand = await readSource("src/cli/commands/topics/create.ts");
    const deleteCommand = await readSource("src/cli/commands/topics/delete.ts");
    const describeCommand = await readSource("src/cli/commands/topics/describe.ts");
    const linkCommand = await readSource("src/cli/commands/topics/link.ts");
    const renameCommand = await readSource("src/cli/commands/topics/rename.ts");
    const unlinkCommand = await readSource("src/cli/commands/topics/unlink.ts");
    const mutationRender = await readSource(
      "src/cli/commands/topics/mutation-render.ts",
    );
    const topicPageMutations = await readSource(
      "src/services/wiki/topic-page-mutations.ts",
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
    expect(existsSync(join(ROOT, "src/cli/commands/topics/workspace.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/topics/page-rewrite.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/wiki/topic-page-rewrite.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/stores/wiki/topics/page-rewrite.ts"))).toBe(true);
    expect(topicPageMutations).toContain("stores/wiki/topics/page-rewrite.js");
    expect(topicPageMutations).not.toContain("fast-glob");
    expect(topicPageMutations).not.toContain("readFile");
    expect(topicPageRewrite).toContain("fast-glob");
    expect(topicPageRewrite).toContain("readFile");
    expect(existsSync(join(ROOT, "src/services/wiki/topic-mutations.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/topics/read.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/topics/render.ts"))).toBe(false);
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
    const tagCommand = await readSource("src/cli/commands/tag.ts");
    const tagRender = await readSource("src/cli/commands/tag-render.ts");
    const pageTopicService = await readSource(
      "src/services/wiki/page-topic-mutations.ts",
    );

    expect(existsSync(join(ROOT, "src/cli/commands/tag-render.ts"))).toBe(true);
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
    const reviewCommand = await readSource("src/cli/commands/review.ts");
    const reviewRender = await readSource("src/cli/commands/review-render.ts");
    const reviewService = await readSource("src/services/wiki/reviews.ts");
    const reviewTypes = await readSource("src/services/wiki/review-types.ts");
    const reviewWorkspace = await readSource(
      "src/services/wiki/review-workspace.ts",
    );

    expect(existsSync(join(ROOT, "src/cli/commands/review-render.ts"))).toBe(true);
    expect(reviewCommand).toContain("services/wiki/reviews.js");
    expect(reviewCommand).toContain("review-render.js");
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
    expect(reviewCommand).toContain("interface ReviewShowOptions");
    expect(reviewCommand).toContain("renderReviewAddResult");
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

  it("keeps the sync command owning its command contract", async () => {
    const syncCommand = await readSource("src/cli/commands/sync.ts");
    const syncRender = await readSource("src/cli/commands/sync-render.ts");

    expect(existsSync(join(ROOT, "src/cli/commands/sync-render.ts"))).toBe(true);
    expect(syncCommand).not.toContain("import type { CommandResult }");
    expect(syncCommand).not.toContain("extends SyncWorkflowOptions");
    expect(syncCommand).toContain("homeDir: string");
    expect(syncCommand).toContain("toSyncWorkflowOptions");
    expect(syncCommand).not.toContain("renderOutcome");
    expect(syncCommand).not.toContain("renderError");
    expect(syncCommand).not.toContain("function renderSyncSummary");
    expect(syncCommand).not.toContain("sync status completed");
    expect(syncRender).toContain("renderSyncResult");
    expect(syncRender).toContain("function renderSyncSummary");
  });

  it("keeps jobs command adapters out of job storage and process mechanics", async () => {
    const jobsServiceIndex = await readSource("src/services/jobs/index.ts");
    const jobsServiceTypes = await readSource("src/services/jobs/types.ts");
    const jobsService = await readSource("src/services/jobs/jobs.ts");
    const jobsServiceView = await readSource("src/services/jobs/view.ts");
    const jobsCommand = await readSource("src/cli/commands/jobs.ts");
    const jobsRender = await readSource("src/cli/commands/jobs-render.ts");
    const jobsRegistration = await readSource(
      "src/edges/cli/register-jobs-commands.ts",
    );

    expect(existsSync(join(ROOT, "src/cli/commands/jobs-format.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/cli/commands/jobs-render.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/view.ts"))).toBe(true);
    expect(jobsServiceIndex).not.toContain("../../jobs");
    expect(jobsServiceIndex).not.toContain("./runtime/index.js");
    expect(jobsServiceIndex).not.toContain("writeJobRecord");
    expect(jobsServiceIndex).not.toContain("startForegroundJob");
    expect(jobsServiceTypes).not.toContain("RuntimeJobView");
    expect(jobsServiceTypes).not.toContain("JobView as");
    expect(jobsServiceTypes).not.toContain("JobRequest extends JobsRequest");
    expect(jobsServiceTypes).not.toContain(
      "StreamJobLogRequest extends JobRequest",
    );
    expect(jobsServiceTypes).not.toContain("CancelJobRequest extends JobRequest");
    expect(jobsCommand).toContain("services/jobs/index.js");
    expect(jobsCommand).not.toContain("../../jobs/index");
    expect(jobsCommand).not.toContain("import type { CommandResult }");
    expect(jobsCommand).not.toContain("extends JobsOptions");
    expect(jobsCommand).toContain("JobsCommandResult");
    expect(jobsCommand).toContain("toJobsRequest");
    expect(jobsCommand).toContain("toJobRequest");
    expect(jobsCommand).toContain("toStreamJobLogRequest");
    expect(jobsCommand).toContain("toCancelJobRequest");
    expect(jobsCommand).not.toContain("readJobRecord");
    expect(jobsCommand).not.toContain("writeJobRecord");
    expect(jobsCommand).not.toContain("resolveJobRecordPath");
    expect(jobsCommand).not.toContain("resolveJobLogPath");
    expect(jobsCommand).not.toContain("finishJobRecord");
    expect(jobsCommand).not.toContain("process.kill");
    expect(jobsCommand).not.toContain("process.stdout");
    expect(jobsCommand).not.toContain("JSON.stringify");
    expect(jobsCommand).not.toContain("formatJobRows");
    expect(jobsCommand).not.toContain("formatJobDetails");
    expect(jobsCommand).not.toContain("terminalAttachSummary");
    expect(jobsCommand).not.toContain("No jobs found");
    expect(jobsCommand).not.toContain("No log events");
    expect(jobsCommand).not.toContain("cancelled job");
    expect(jobsCommand).not.toContain("function formatPageChanges");
    expect(jobsCommand).not.toContain("function formatMs");
    expect(jobsCommand).not.toContain("function missingWiki");
    expect(jobsRender).toContain("renderJobsListResult");
    expect(jobsRender).toContain("renderJobsShowResult");
    expect(jobsRender).toContain("renderStreamJobLogResult");
    expect(jobsRender).toContain("renderCancelJobResult");
    expect(jobsRegistration).toContain("write: (chunk)");
    expect(jobsService).not.toContain("JobView as RuntimeJobView");
    expect(jobsService).not.toContain("function jobServiceViewFromRuntime");
    expect(jobsService).not.toContain("toJobView");
    expect(jobsService).not.toContain("platform/process");
    expect(jobsService).not.toContain("readFile");
    expect(jobsService).not.toContain("resolveJobRecordPath");
    expect(jobsService).not.toContain("resolveJobLogPath");
    expect(jobsService).not.toContain("writeJobRecord");
    expect(jobsService).not.toContain("./runtime/index.js");
    expect(jobsService).toContain("stores/jobs/index.js");
    expect(jobsService).toContain("record-lifecycle.js");
    expect(jobsServiceView).not.toContain("platform/process");
    expect(jobsServiceView).not.toContain("./runtime/index.js");
    expect(jobsServiceView).toContain("./record-view.js");
    expect(jobsServiceTypes).toContain("isPidAlive: (pid: number) => boolean");
    expect(jobsServiceTypes).toContain(
      "signalProcess: (pid: number, signal: NodeJS.Signals) => void",
    );
    expect(jobsRegistration).toContain("isLocalPidAlive");
    expect(jobsRegistration).toContain("signalLocalPid");
    expect(jobsServiceView).toContain("function jobServiceViewFromRuntime");
    expect(jobsServiceView).toContain("toJobView");
  });

  it("keeps job run projection concerns in named modules", async () => {
    const projectionView = await readSource("src/services/jobs/projections/view.ts");
    const logEvents = await readSource("src/services/jobs/projections/log-events.ts");
    const agentTraces = await readSource("src/services/jobs/projections/agent-traces.ts");
    const warnings = await readSource("src/services/jobs/projections/warnings.ts");
    const viewerJobs = await readSource("src/edges/viewer/read-model/jobs.ts");

    expect(existsSync(join(ROOT, "src/jobs"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/jobs/projections/agent-traces.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/projections/warnings.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/projections/text.ts"))).toBe(true);
    expect(projectionView).not.toContain("export function deriveJobAgentTraces");
    expect(projectionView).not.toContain("export function deriveJobWarnings");
    expect(logEvents).not.toContain("node:fs/promises");
    expect(logEvents).not.toContain("readFile");
    expect(logEvents).not.toContain("readJobLogEvents(path");
    expect(logEvents).toContain("readJobLogContents");
    expect(agentTraces).toContain("export function deriveJobAgentTraces");
    expect(warnings).toContain("export function deriveJobWarnings");
    expect(viewerJobs).toContain("projections/agent-traces.js");
    expect(viewerJobs).toContain("projections/warnings.js");
    expect(viewerJobs).not.toContain("services/jobs/runtime/index.js");
    expect(viewerJobs).toContain("stores/jobs/index.js");
    expect(viewerJobs).toContain("services/jobs/record-view.js");
  });

  it("keeps job record persistence in an explicit store", () => {
    expect(existsSync(join(ROOT, "src/stores/jobs/records.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/types.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/record-schema.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/jobs/records.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/jobs"))).toBe(false);
  });

  it("keeps job worker process spawning out of job record startup", async () => {
    const jobStart = await readSource("src/services/jobs/runtime/start.ts");
    const jobRecordLifecycle = await readSource(
      "src/services/jobs/record-lifecycle.ts",
    );
    const workerProgram = await readSource("src/shared/worker-program.ts");
    const jobWorker = await readSource("src/edges/worker/job-worker.ts");
    const queueDrain = await readSource("src/services/jobs/runtime/queue-drain.ts");
    const backgroundStart = await readSource(
      "src/services/jobs/runtime/background-start.ts",
    );
    const backgroundProcess = await readSource("src/platform/jobs/worker-process.ts");
    const appCliRuntime = await readSource("src/app/cli-runtime.ts");
    const lifecycleOperations = await readSource(
      "src/services/lifecycle/operations/types.ts",
    );
    const lifecycleWorkflows = await readSource("src/services/lifecycle/workflows.ts");
    const lifecycleWorkflowTypes = await readSource(
      "src/services/lifecycle/workflow-types.ts",
    );
    const cliRuntime = await readSource("src/edges/cli/current-cli.ts");

    expect(existsSync(join(ROOT, "src/edges/worker/job-worker.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/queue-drain.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/worker.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/shared/worker-program.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/record-factory.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/index.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/jobs/record-lifecycle.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/background-start.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/jobs/worker-process.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/app/cli-runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/background-jobs.ts"))).toBe(false);
    expect(workerProgram).toContain("export interface JobWorkerProgram");
    expect(jobStart).not.toContain("node:child_process");
    expect(jobStart).not.toContain("startJobWorkerProcess");
    expect(jobStart).not.toContain("writeJobSpec");
    expect(jobStart).not.toContain("cannot start background process");
    expect(backgroundStart).not.toContain("platform/jobs");
    expect(backgroundStart).not.toContain("startJobWorkerProcess");
    expect(backgroundStart).toContain("startWorker");
    expect(backgroundStart).toContain("writeJobSpec");
    expect(jobStart).not.toContain("function defaultSpawnBackground");
    expect(backgroundProcess).toContain("node:child_process");
    expect(backgroundProcess).toContain("export function startJobWorkerProcess");
    expect(backgroundProcess).toContain("startDetachedJobWorkerProcess");
    expect(appCliRuntime).toContain("startDetachedJobWorkerProcess");
    expect(appCliRuntime).toContain("startBackgroundJob");
    expect(appCliRuntime).toContain("createAgentRuntimeJobRunner");
    expect(backgroundProcess).not.toContain("process.env");
    expect(backgroundProcess).not.toContain("process.execPath");
    expect(jobStart).not.toContain("process.pid");
    expect(jobRecordLifecycle).not.toContain("process.pid");
    expect(queueDrain).not.toContain("process.pid");
    expect(jobRecordLifecycle).toContain("pid: number");
    expect(jobStart).toContain("pid: number");
    expect(jobWorker).toContain("pid: number");
    expect(jobWorker).toContain("drainQueuedJobs");
    expect(jobWorker).not.toContain("oldestQueuedJob");
    expect(jobWorker).not.toContain("acquireJobWorkerLock");
    expect(queueDrain).not.toContain("process.");
    expect(backgroundStart).not.toContain("process.argv");
    expect(backgroundStart).toContain("workerEnvironment");
    expect(backgroundStart).toContain("workerProgram");
    expect(backgroundStart).toContain("shared/worker-program.js");
    expect(backgroundProcess).toContain("shared/worker-program.js");
    expect(cliRuntime).toContain("shared/worker-program.js");
    expect(lifecycleOperations).toContain("shared/worker-program.js");
    expect(lifecycleOperations).not.toContain("platform/jobs/worker-process");
    expect(lifecycleWorkflowTypes).toContain("shared/worker-program.js");
    expect(lifecycleWorkflows).not.toContain("platform/jobs/worker-process");
  });

  it("keeps job spec and log persistence in explicit stores", () => {
    expect(existsSync(join(ROOT, "src/stores/jobs/specs.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/logs.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/index.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/log-entry.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/jobs/spec.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/jobs"))).toBe(false);
  });

  it("keeps worker lock persistence out of job queue selection", async () => {
    const queue = await readSource("src/services/jobs/runtime/queue.ts");

    expect(existsSync(join(ROOT, "src/stores/jobs/worker-lock.ts"))).toBe(true);
    expect(queue).not.toContain("worker.lock");
    expect(queue).not.toContain("mkdir");
    expect(queue).not.toContain("process.kill");
  });

  it("keeps sync runtime persistence in explicit stores", async () => {
    const syncLedger = await readSource("src/services/sync/ledger.ts");
    const syncSweep = await readSource("src/services/sync/sweep.ts");

    expect(existsSync(join(ROOT, "src/stores/sync/ledger.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/sync/lock.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/sync"))).toBe(false);
    expect(syncLedger).not.toContain("sync-ledger.json");
    expect(syncLedger).not.toContain("capture-ledger.json");
    expect(syncLedger).not.toContain("mkdir");
    expect(syncSweep).not.toContain("sync.lock");
  });

  it("keeps sync transcript file mechanics in platform transcripts", async () => {
    const syncSweep = await readSource("src/services/sync/sweep.ts");
    const syncLedger = await readSource("src/services/sync/ledger.ts");
    const syncResults = await readSource("src/services/sync/sweep-results.ts");
    const transcriptCursor = await readSource("src/services/sync/transcript-cursor.ts");
    const transcriptSnapshot = await readSource("src/platform/transcripts/snapshot.ts");
    const transcriptDiscovery = await readSource("src/platform/transcripts/index.ts");
    const sharedTranscripts = await readSource("src/shared/transcripts.ts");

    expect(existsSync(join(ROOT, "src/services/sync/transcript-cursor.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/transcripts/snapshot.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/transcripts/types.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/shared/transcripts.ts"))).toBe(true);
    expect(syncSweep).toContain("transcript-cursor.js");
    expect(syncSweep).toContain("shared/transcripts.js");
    expect(syncSweep).not.toContain("platform/transcripts");
    expect(syncSweep).not.toContain("from \"node:fs/promises\"");
    expect(syncSweep).not.toContain("function readTranscriptSnapshot");
    expect(syncSweep).toContain("ReadSyncTranscriptSnapshotFn");
    expect(syncSweep).not.toContain("function evaluateSyncCursor");
    expect(syncSweep).not.toContain("lastAbsorbedPrefixHash");
    expect(syncSweep).not.toContain("pendingPrefixHash");
    expect(syncLedger).not.toContain("platform/transcripts");
    expect(syncResults).not.toContain("platform/transcripts");
    expect(transcriptCursor).not.toContain("platform/transcripts");
    expect(syncLedger).toContain("transcriptCursorForSince");
    expect(transcriptCursor).not.toContain("from \"node:fs/promises\"");
    expect(transcriptCursor).not.toContain("readTranscriptSnapshot");
    expect(transcriptCursor).toContain("export function evaluateSyncCursor");
    expect(transcriptCursor).toContain("export function pendingLedgerEntry");
    expect(transcriptSnapshot).toContain("from \"node:fs/promises\"");
    expect(transcriptSnapshot).toContain("export async function readTranscriptSnapshot");
    expect(transcriptSnapshot).not.toContain("transcriptCursorForSince");
    expect(transcriptSnapshot).not.toContain("parseJsonObject");
    expect(transcriptDiscovery).toContain("shared/transcripts.js");
    expect(sharedTranscripts).toContain("export interface TranscriptCandidate");
    expect(sharedTranscripts).toContain("export interface TranscriptSnapshot");
    expect(sharedTranscripts).toContain("transcriptCursorForSince");
  });

  it("keeps local process signaling in the platform layer", async () => {
    const jobsService = await readSource("src/services/jobs/jobs.ts");
    const viewerJobs = await readSource("src/edges/viewer/read-model/jobs.ts");
    const jobWorkerLockStore = await readSource("src/stores/jobs/worker-lock.ts");
    const syncLockStore = await readSource("src/stores/sync/lock.ts");
    const syncSweep = await readSource("src/services/sync/sweep.ts");
    const jobWorker = await readSource("src/edges/worker/job-worker.ts");
    const appCliRuntime = await readSource("src/app/cli-runtime.ts");
    const cliRunner = await readSource("src/edges/cli/run.ts");
    const lifecycleRegistration = await readSource(
      "src/edges/cli/register-lifecycle-run-commands.ts",
    );
    const syncRegistration = await readSource(
      "src/edges/cli/register-sync-commands.ts",
    );

    expect(existsSync(join(ROOT, "src/platform/process.ts"))).toBe(true);
    for (const source of [jobsService, viewerJobs, jobWorkerLockStore, syncLockStore]) {
      expect(source).not.toContain("process.kill");
    }
    for (const source of [jobWorkerLockStore, syncLockStore]) {
      expect(source).toContain("pid-liveness.js");
      expect(source).toContain("ownerPid");
      expect(source).toContain("isPidAlive");
      expect(source).not.toContain("platform/process");
      expect(source).not.toContain("process.pid");
    }
    expect(syncSweep).toContain("isPidAlive");
    expect(syncSweep).not.toContain("platform/process");
    expect(jobWorker).toContain("isPidAlive");
    expect(jobWorker).not.toContain("platform/process");
    expect(appCliRuntime).toContain("isLocalPidAlive");
    expect(cliRunner).toContain("isLocalPidAlive");
    expect(lifecycleRegistration).toContain("createCliRuntime");
    expect(lifecycleRegistration).not.toContain("platform/process");
    expect(syncRegistration).toContain("createCliRuntime");
    expect(syncRegistration).not.toContain("platform/process");
  });

  it("keeps store atomic writes off process identity", async () => {
    const atomicWrite = await readSource("src/stores/atomic-write.ts");
    const storeWriters = await Promise.all([
      readSource("src/stores/jobs/records.ts"),
      readSource("src/stores/jobs/specs.ts"),
      readSource("src/stores/sync/ledger.ts"),
      readSource("src/stores/config/store.ts"),
      readSource("src/stores/config/editor.ts"),
      readSource("src/stores/update/state.ts"),
      readSource("src/stores/wiki-registry/store.ts"),
      readSource("src/stores/wiki-review/store.ts"),
      readSource("src/stores/wiki/topics/yaml.ts"),
      readSource("src/stores/wiki/topics/frontmatter-rewrite.ts"),
      readSource("src/stores/wiki/sources/maintenance.ts"),
    ]);

    expect(atomicWrite).toContain("randomUUID");
    expect(atomicWrite).toContain("writeTextFileAtomically");
    for (const source of storeWriters) {
      expect(source).toContain("writeTextFileAtomically");
      expect(source).not.toContain("process.pid");
      expect(source).not.toContain(".tmp-${process.pid}");
    }
  });

  it("keeps automation command adapters out of launchd workflow mechanics", async () => {
    const automationServiceIndex = await readSource("src/services/automation/index.ts");
    const automationServiceTypes = await readSource("src/services/automation/types.ts");
    const automationPlanning = await readSource("src/services/automation/planning.ts");
    const automationWorkflow = await readSource("src/services/automation/automation.ts");
    const automationMigration = await readSource("src/services/automation/migration.ts");
    const automationCatalog = await readSource("src/services/automation/catalog.ts");
    const automationLegacyHooks = await readSource("src/services/automation/legacy-hooks.ts");
    const automationTasks = await readSource("src/services/automation/tasks.ts");
    const automationScheduler = await readSource("src/services/automation/scheduler.ts");
    const automationAppRuntime = await readSource("src/app/automation-runtime.ts");
    const automationRegistration = await readSource("src/edges/cli/register-automation-commands.ts");
    const migrateRegistration = await readSource("src/edges/cli/register-migrate-commands.ts");
    const setupAutomationStep = await readSource("src/edges/cli/setup/automation-step.ts");
    const setupAutoUpdateStep = await readSource("src/edges/cli/setup/auto-update-step.ts");
    const uninstallEdge = await readSource("src/edges/cli/uninstall.ts");
    const launchdAutomationScheduler = await readSource("src/platform/automation/scheduler.ts");
    const automationPaths = await readSource("src/platform/automation/paths.ts");
    const automationCommand = await readSource("src/cli/commands/automation.ts");
    const automationRender = await readSource("src/cli/commands/automation-render.ts");

    expect(existsSync(join(ROOT, "src/cli/commands/automation-render.ts"))).toBe(
      true,
    );
    expect(automationServiceIndex).not.toContain("platform/automation");
    expect(automationServiceTypes).not.toContain("platform/automation");
    expect(automationServiceTypes).not.toContain("PlatformExecFn");
    expect(automationServiceTypes).not.toContain("PlatformScheduledTaskId");
    expect(automationServiceTypes).not.toContain("NodeJS.ProcessEnv");
    expect(automationServiceTypes).toContain("homeDir: string");
    expect(automationPlanning).not.toContain("process.cwd()");
    expect(automationPlanning).not.toContain("process.env");
    expect(automationPlanning).not.toContain("homedir");
    expect(automationPlanning).not.toContain("platform/automation/tasks");
    expect(automationPlanning).not.toContain("platform/automation/launchd");
    expect(automationPlanning).not.toContain("platform/automation/paths");
    expect(automationPlanning).not.toContain("buildLaunchPath");
    expect(automationPlanning).not.toContain("automationLogPaths");
    expect(automationPlanning).not.toContain("launchAgentPlistPath");
    expect(automationPlanning).not.toContain("LaunchdJobDefinition");
    expect(automationWorkflow).not.toContain("platform/automation");
    expect(automationMigration).not.toContain("platform/automation");
    expect(automationWorkflow).not.toContain("homedir");
    expect(automationWorkflow).not.toContain("existsSync");
    expect(automationMigration).not.toContain("homedir");
    expect(automationMigration).not.toContain("readProgramArgumentAfter");
    expect(automationMigration).not.toContain("removeLaunchdJob");
    expect(automationCatalog).not.toContain("homedir");
    expect(automationLegacyHooks).not.toContain("platform/automation");
    expect(automationLegacyHooks).not.toContain("homeDir?: string");
    expect(automationLegacyHooks).not.toContain("= {}");
    expect(automationTasks).not.toContain("process.argv");
    expect(automationTasks).not.toContain("process.cwd()");
    expect(automationTasks).not.toContain("process.execPath");
    expect(automationTasks).not.toContain("task.programArguments");
    expect(automationTasks).not.toContain("LaunchAgents");
    expect(automationTasks).not.toContain("path.join");
    expect(automationTasks).toContain("automationTaskDefinition");
    expect(automationPaths).toContain("LaunchAgents");
    expect(automationPaths).toContain("launchAgentPlistPath");
    expect(automationScheduler).toContain("export interface AutomationScheduler");
    expect(automationScheduler).toContain("programArguments: string[] | null");
    expect(existsSync(join(ROOT, "src/app/automation-runtime.ts"))).toBe(true);
    expect(automationAppRuntime).toContain("createLaunchdAutomationScheduler");
    for (const source of [
      automationRegistration,
      migrateRegistration,
      setupAutomationStep,
      setupAutoUpdateStep,
      uninstallEdge,
    ]) {
      expect(source).toContain("createAutomationScheduler");
      expect(source).not.toContain("platform/automation/scheduler");
      expect(source).not.toContain("createLaunchdAutomationScheduler");
    }
    expect(launchdAutomationScheduler).toContain("createLaunchdAutomationScheduler");
    expect(launchdAutomationScheduler).toContain("buildLaunchPath");
    expect(launchdAutomationScheduler).toContain("automationLogPaths");
    expect(launchdAutomationScheduler).toContain("launchAgentPlistPath");
    expect(launchdAutomationScheduler).toContain("readLaunchdProgramArguments");
    expect(existsSync(join(ROOT, "src/platform/automation/job-plan.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/platform/automation/tasks.ts"))).toBe(false);
    expect(automationCommand).toContain("services/automation/index.js");
    expect(automationCommand).not.toContain("import type { CommandResult }");
    expect(automationCommand).toContain("AutomationCommandResult");
    expect(automationCommand).not.toContain("platform/automation");
    expect(automationCommand).not.toContain("platform/automation/launchd");
    expect(automationCommand).not.toContain("platform/automation/tasks");
    expect(automationCommand).not.toContain("platform/automation/legacy-hooks");
    expect(automationCommand).not.toContain("ensureAutomationSyncSince");
    expect(automationCommand).not.toContain("findNearestAlmanacDir");
    expect(automationCommand).not.toContain("writeLaunchdPlist");
    expect(automationCommand).not.toContain("bootstrapLaunchdJob");
    expect(automationCommand).not.toContain("removeLaunchdJob");
    expect(automationCommand).not.toContain("readLaunchdJobStatus");
    expect(automationCommand).not.toContain("TASK_LABELS");
    expect(automationCommand).not.toContain("formatAutomationStatusSection");
    expect(automationCommand).not.toContain("defaultPlistPath");
    expect(automationCommand).not.toContain("automation installed");
    expect(automationCommand).not.toContain("legacy automation");
    expect(automationServiceIndex).not.toContain("defaultSyncAutomationPlistPath");
    expect(automationRender).toContain("renderAutomationInstallResult");
    expect(automationRender).toContain("formatAutomationStatusSection");
  });

  it("keeps update command adapters out of update workflow mechanics", async () => {
    const updateCommand = await readSource("src/cli/commands/update.ts");
    const updateRender = await readSource("src/cli/commands/update-render.ts");
    const updateServiceIndex = await readSource("src/services/update/index.ts");
    const updateService = await readSource("src/services/update/update.ts");
    const updateTypes = await readSource("src/services/update/types.ts");
    const updateInstall = await readSource("src/platform/update/install.ts");
    const updateRuntime = await readSource("src/platform/update/runtime.ts");
    const updateCheck = await readSource("src/platform/update/check.ts");
    const updateAnnounce = await readSource("src/platform/update/announce.ts");
    const updateStoreIndex = await readSource("src/stores/update/index.ts");
    const updateStateStore = await readSource("src/stores/update/state.ts");
    const updateLockStore = await readSource("src/stores/update/lock.ts");
    const setupRegistration = await readSource("src/edges/cli/register-setup-commands.ts");

    expect(existsSync(join(ROOT, "src/cli/commands/update-render.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/stores/update/state.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/update/lock.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/update/state.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/platform/update/lock.ts"))).toBe(false);
    expect(updateServiceIndex).not.toContain("platform/update");
    expect(updateCommand).toContain("services/update/index.js");
    expect(updateCommand).toContain("./update-render.js");
    expect(updateCommand).not.toContain("platform/update");
    expect(updateCommand).not.toContain("readConfig");
    expect(updateCommand).not.toContain("writeConfig");
    expect(updateCommand).not.toContain("readState");
    expect(updateCommand).not.toContain("writeState");
    expect(updateCommand).not.toContain("acquireUpdateLock");
    expect(updateCommand).not.toContain("installLatestPackage");
    expect(updateCommand).not.toContain("spawn");
    expect(updateCommand).not.toContain("stdout:");
    expect(updateCommand).not.toContain("stderr:");
    expect(updateCommand).not.toContain("exitCode:");
    expect(updateCommand).not.toContain("registry.npmjs.org");
    expect(updateCommand).not.toContain("already dismissed");
    expect(updateCommand).not.toContain("update notifier enabled");
    expect(updateCommand).not.toContain("install-result");

    expect(updateRender).toContain("renderUpdateResult");
    expect(updateRender).toContain("renderNotifierUpdated");
    expect(updateRender).toContain("registryFailureSuffix");

    expect(updateService).not.toContain("stdout:");
    expect(updateService).not.toContain("stderr:");
    expect(updateService).not.toContain("exitCode:");
    expect(updateService).not.toContain("node:child_process");
    expect(updateService).not.toContain("platform/update");
    expect(updateService).not.toContain("platform/update/state");
    expect(updateService).not.toContain("platform/update/lock");
    expect(updateService).toContain("stores/update/index.js");
    expect(updateService).toContain("opts.runtime.readInstalledVersion()");
    expect(updateService).toContain("opts.runtime.checkForUpdate");
    expect(updateService).toContain("opts.runtime.installLatestPackage()");
    expect(updateService).not.toContain("updateInstallResultFromPlatform");
    expect(updateTypes).not.toContain(
      "UpdateInstallResult = PlatformInstallLatestPackageResult",
    );
    expect(updateTypes).not.toContain("typeof platformCheckForUpdate");
    expect(updateTypes).not.toContain("typeof nodeSpawn");
    expect(updateTypes).not.toContain("UpdateInstallSpawnFn");
    expect(updateTypes).not.toContain("SpawnOptions");
    expect(updateTypes).not.toContain("node:child_process");
    expect(updateTypes).toContain("UpdateInstallFn");
    expect(updateTypes).toContain("export interface UpdateRuntime");
    expect(updateTypes).toContain("runtime: UpdateRuntime");
    expect(updateTypes).toContain("pid?: number");
    expect(updateTypes).not.toContain("platform/update/check");
    expect(updateInstall).toContain("node:child_process");
    expect(updateInstall).toContain("spawnFn");
    expect(updateRuntime).toContain("createPlatformUpdateRuntime");
    expect(updateRuntime).toContain("installLatestPackage");
    expect(updateRuntime).toContain("readInstalledVersion");
    expect(updateRuntime).toContain("updateInstallResultFromPlatform");
    expect(updateCheck).toContain("stores/update/index.js");
    expect(updateAnnounce).toContain("stores/update/index.js");
    expect(updateAnnounce).not.toContain("readFileSync(path");
    expect(updateStoreIndex).toContain("readStateSync");
    expect(updateStateStore).toContain("readFileSync");
    expect(updateLockStore).toContain("pid: number");
    expect(updateLockStore).toContain("pid: options.pid");
    expect(updateLockStore).not.toContain("process.pid");
    expect(setupRegistration).toContain("createPlatformUpdateRuntime");
    expect(setupRegistration).toContain("runtime: createPlatformUpdateRuntime()");
    expect(setupRegistration).toContain("pid: process.pid");
  });

  it("keeps config command adapters out of config persistence mechanics", async () => {
    const configCommand = await readSource("src/cli/commands/config.ts");
    const configRender = await readSource("src/cli/commands/config-render.ts");
    const configStore = await readSource("src/stores/config/store.ts");
    const configPatch = await readSource("src/stores/config/stored-patch.ts");
    const configIndex = await readSource("src/stores/config/index.ts");

    expect(existsSync(join(ROOT, "src/config"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/config-render.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/stores/config/stored-patch.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/provider-enablement.ts"))).toBe(true);
    expect(configCommand).toContain("services/config/index.js");
    expect(configCommand).not.toContain("../../config/index");
    expect(configCommand).not.toContain("node:fs");
    expect(configCommand).not.toContain("parseConfigText");
    expect(configCommand).not.toContain("readConfig(");
    expect(configCommand).not.toContain("readConfigWithOrigins(");
    expect(configCommand).not.toContain("serializeConfig");
    expect(configCommand).not.toContain("getProjectConfigPath");
    expect(configCommand).not.toContain("process.cwd()");
    expect(configCommand).not.toContain("parseConfigKey");
    expect(configCommand).not.toContain("formatTextTable");
    expect(configCommand).not.toContain("JSON.stringify");
    expect(configCommand).not.toContain("formatConfigValue");
    expect(configCommand).not.toContain("unknown config key");
    expect(configCommand).not.toContain("missing value");
    expect(configCommand).not.toContain("no .almanac/ found");
    expect(configCommand).toContain("readConfigEntryByKey");
    expect(configCommand).toContain("setConfigEntryByKey");
    expect(configCommand).toContain("unsetConfigEntryByKey");
    expect(configRender).toContain("unknown config key");
    expect(configRender).toContain("missing value");
    expect(configRender).toContain("formatTextTable");
    expect(configRender).toContain("renderConfigList");
    expect(configRender).toContain("renderConfigSet");
    expect(existsSync(join(ROOT, "src/cli/commands/config-keys.ts"))).toBe(false);
    expect(configStore).not.toContain("function toStoredConfigPatch");
    expect(configStore).not.toContain("function setStoredValue");
    expect(configStore).not.toContain("function pruneEmptyObjects");
    expect(configPatch).toContain("toStoredConfigPatch");
    expect(configPatch).toContain("pruneEmptyObjects");
    expect(configIndex).not.toContain("getEnabledAgentProviderIds");
    expect(configIndex).not.toContain("isEnabledAgentProviderId");
    expect(configIndex).not.toContain("disabledAgentProviderMessage");
  });

  it("keeps agents command adapters out of readiness and config mechanics", async () => {
    const agentsServiceIndex = await readSource("src/services/agents/index.ts");
    const agentsService = await readSource("src/services/agents/agents.ts");
    const agentsCommand = await readSource("src/cli/commands/agents.ts");
    const agentsRender = await readSource("src/cli/commands/agents-render.ts");

    expect(agentsServiceIndex).not.toContain("../../agent/");
    expect(agentsServiceIndex).not.toContain("../../config/");
    expect(agentsService).not.toContain("AgentsProviderReadiness = ProviderReadiness");
    expect(agentsService).not.toContain("AgentsProviderView = ProviderSetupView");
    expect(agentsService).not.toContain("AgentsAgentProviderId = AgentProviderId");
    expect(agentsService).toContain("agentsProviderViewFromSetupView");
    expect(agentsCommand).toContain("services/agents/index.js");
    expect(agentsCommand).not.toContain("agent/readiness");
    expect(agentsCommand).not.toContain("../../config/index");
    expect(agentsCommand).not.toContain("process.cwd()");
    expect(agentsCommand).not.toContain("readConfig");
    expect(agentsCommand).not.toContain("writeConfig");
    expect(agentsCommand).not.toContain("parseAgentSelection");
    expect(agentsCommand).not.toContain("isAgentProviderId");
    expect(agentsCommand).not.toContain("formatTextTable");
    expect(agentsCommand).not.toContain("readinessLabel");
    expect(agentsCommand).not.toContain("unknown agent");
    expect(agentsCommand).not.toContain("missing model");
    expect(agentsRender).toContain("renderAgentsList");
    expect(agentsRender).toContain("renderAgentsDoctor");
    expect(agentsRender).toContain("renderSetDefaultAgentResult");
    expect(agentsRender).toContain("renderSetAgentModelResult");
  });

  it("keeps setup agent choice UI out of readiness and config mechanics", async () => {
    const setupServiceIndex = await readSource("src/services/setup/index.ts");
    const setupServiceAgentChoice = await readSource(
      "src/services/setup/agent-choice.ts",
    );
    const setupAgentChoice = await readSource(
      "src/edges/cli/setup/agent-choice.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/agent-choice.ts"))).toBe(true);
    expect(setupServiceIndex).not.toContain("../../agent/");
    expect(setupServiceIndex).not.toContain("../../config/");
    expect(setupServiceAgentChoice).not.toContain("SetupSpawnCliFn = SpawnCliFn");
    expect(setupServiceAgentChoice).not.toContain(
      "SetupProviderView = ProviderSetupView",
    );
    expect(setupServiceAgentChoice).not.toContain(
      "SetupProviderModelChoice = ProviderModelChoice",
    );
    expect(setupServiceAgentChoice).not.toContain(
      "SetupAgentProviderId = AgentProviderId",
    );
    expect(setupServiceAgentChoice).not.toContain(
      "SetupConfiguredModels = Partial",
    );
    expect(setupServiceAgentChoice).toContain(
      "setupConfiguredModelsFromConfig",
    );
    expect(setupServiceAgentChoice).toContain(
      "setupProviderViewFromReadinessView",
    );
    expect(setupAgentChoice).toContain("services/setup/index.js");
    expect(setupAgentChoice).not.toContain("../../../agent");
    expect(setupAgentChoice).not.toContain("agent/readiness/view");
    expect(setupAgentChoice).not.toContain("../../../config/index");
    expect(setupAgentChoice).not.toContain("readConfig");
    expect(setupAgentChoice).not.toContain("writeConfig");
    expect(setupAgentChoice).not.toContain("config.agent");
    expect(setupAgentChoice).not.toContain("parseAgentSelection");
    expect(setupAgentChoice).not.toContain("isAgentProviderId");
  });

  it("keeps setup input controls out of display rendering", async () => {
    const setupOutput = await readSource("src/edges/cli/setup/output.ts");
    const setupInput = await readSource("src/edges/cli/setup/input.ts");
    const setupIndex = await readSource("src/edges/cli/setup/index.ts");
    const setupNextSteps = await readSource(
      "src/edges/cli/setup/next-steps.ts",
    );
    const setupAutomationStep = await readSource(
      "src/edges/cli/setup/automation-step.ts",
    );
    const setupAutoUpdateStep = await readSource(
      "src/edges/cli/setup/auto-update-step.ts",
    );
    const setupServiceIndex = await readSource("src/services/setup/index.ts");
    const setupWikiState = await readSource("src/services/wiki/setup-state.ts");
    const setupTypes = await readSource("src/edges/cli/setup/types.ts");
    const setupRegistration = await readSource(
      "src/edges/cli/register-setup-commands.ts",
    );
    const sqliteFree = await readSource("src/edges/cli/sqlite-free.ts");
    const currentCli = await readSource("src/edges/cli/current-cli.ts");
    const setupCallers = await Promise.all([
      readSource("src/edges/cli/setup/agent-model-choice.ts"),
      readSource("src/edges/cli/setup/agent-choice.ts"),
      readSource("src/edges/cli/setup/global-install-step.ts"),
      readSource("src/edges/cli/setup/index.ts"),
      readSource("src/edges/cli/setup/instruction-target-choice.ts"),
      readSource("src/edges/cli/setup/setup-plan.ts"),
    ]);

    expect(existsSync(join(ROOT, "src/cli/commands/setup"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/setup"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/input.ts"))).toBe(true);
    expect(setupInput).not.toContain("process.stdin");
    expect(setupInput).toContain("SetupInputStream");
    expect(setupInput).toContain("from \"./output.js\"");
    expect(setupInput).toContain("theme: SetupTheme");
    expect(setupOutput).toContain("makeSetupTheme");
    expect(setupOutput).toContain("../../../ansi-theme.js");
    expect(setupOutput).not.toContain("export const RST");
    expect(setupOutput).not.toContain("export const BAR");
    expect(setupOutput).not.toContain("process.stdout.columns");
    expect(setupOutput).not.toContain("process.stdin");
    expect(setupOutput).not.toContain("setRawMode");
    expect(setupOutput).not.toContain("export function confirm");
    expect(setupOutput).not.toContain("export function promptText");
    expect(setupOutput).not.toContain("export async function selectChoice");
    expect(setupOutput).not.toContain("SetupInterruptedError");
    expect(existsSync(join(ROOT, "src/edges/cli/setup/types.ts"))).toBe(true);
    expect(setupIndex).not.toContain("interface SetupOptions");
    expect(setupIndex).not.toContain("interface SetupResult");
    expect(setupIndex).not.toContain("process.cwd()");
    expect(setupIndex).not.toContain("process.stdout");
    expect(setupIndex).not.toContain("process.stdin.isTTY");
    expect(setupIndex).toContain("makeSetupTheme(options.color !== false)");
    expect(setupIndex).toContain("services/wiki/setup-state.js");
    expect(setupNextSteps).not.toContain("node:fs");
    expect(setupNextSteps).not.toContain("existsSync");
    expect(setupNextSteps).not.toContain("readdirSync");
    expect(setupAutomationStep).not.toContain("../automation.js");
    expect(setupAutomationStep).not.toContain("process.cwd()");
    expect(setupAutoUpdateStep).not.toContain("../automation.js");
    expect(existsSync(join(ROOT, "src/services/setup/wiki-state.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/wiki/setup-state.ts"))).toBe(true);
    expect(setupServiceIndex).not.toContain("readSetupWikiState");
    expect(setupServiceIndex).not.toContain("wiki-state");
    expect(setupWikiState).toContain("existingPageCount");
    expect(setupWikiState).toContain("countWikiPageFilesSync");
    expect(setupWikiState).not.toContain("node:fs");
    expect(setupWikiState).not.toContain("readdirSync");
    expect(setupWikiState).not.toContain("existsSync");
    expect(setupTypes).toContain("interface SetupOptions");
    expect(setupTypes).toContain("interface SetupResult");
    expect(setupTypes).toContain("stdin: SetupInputStream");
    expect(setupTypes).toContain("color?: boolean");
    expect(setupTypes).not.toContain("defaults to `process");
    expect(setupRegistration).toContain("isTTY: process.stdin.isTTY === true");
    expect(setupRegistration).toContain("stdin: process.stdin");
    expect(setupRegistration).toContain("stdout: process.stdout");
    expect(setupRegistration).toContain("color: shouldUseStdoutColor()");
    expect(sqliteFree).toContain("stdin: process.stdin");
    expect(sqliteFree).toContain("color: shouldUseStdoutColor()");
    expect(currentCli).toContain("process.argv");
    expect(currentCli).toContain("process.execPath");
    for (const caller of setupCallers) {
      expect(caller).not.toContain("confirm,\n} from \"./output.js\"");
      expect(caller).not.toContain("promptText,\n} from \"./output.js\"");
      expect(caller).not.toContain("selectChoice,\n} from \"./output.js\"");
      expect(caller).not.toContain("isSetupInterrupted,\n} from \"./output.js\"");
      expect(caller).not.toContain("SetupInterruptedError,\n} from \"./output.js\"");
      expect(caller).not.toContain("process.stdin");
    }
  });

  it("keeps setup global install mechanics in the platform install layer", async () => {
    const globalInstallStep = await readSource(
      "src/edges/cli/setup/global-install-step.ts",
    );
    const setupGlobalInstall = await readSource(
      "src/services/setup/global-install.ts",
    );
    const setupServiceIndex = await readSource("src/services/setup/index.ts");
    const platformSetupRuntime = await readSource("src/platform/setup/runtime.ts");
    const globalPackage = await readSource(
      "src/platform/install/global-package.ts",
    );

    expect(existsSync(join(ROOT, "src/platform/install/global-package.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/setup/runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/setup/global-install.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/install-path.ts"))).toBe(false);
    expect(globalInstallStep).not.toContain("platform/install/global-package.js");
    expect(globalInstallStep).toContain("platform/setup/runtime.js");
    expect(globalInstallStep).toContain("services/setup/index.js");
    expect(globalInstallStep).not.toContain("node:child_process");
    expect(globalInstallStep).not.toContain("node:module");
    expect(globalInstallStep).not.toContain("node:os");
    expect(globalInstallStep).not.toContain("fileURLToPath");
    expect(globalInstallStep).not.toContain("execFile");
    expect(globalInstallStep).not.toContain("detectCurrentInstallPath");
    expect(globalInstallStep).not.toContain("detectEphemeral");
    expect(setupGlobalInstall).not.toContain("platform/");
    expect(setupGlobalInstall).toContain("interface SetupGlobalInstallRuntime");
    expect(setupGlobalInstall).toContain("readSetupGlobalInstallState");
    expect(setupGlobalInstall).toContain("runSetupGlobalInstall");
    expect(setupServiceIndex).toContain("global-install.js");
    expect(platformSetupRuntime).toContain("detectCurrentInstallPath");
    expect(platformSetupRuntime).toContain("detectEphemeral");
    expect(platformSetupRuntime).toContain("spawnGlobalInstall");
    expect(globalPackage).toContain("detectCurrentInstallPath");
    expect(globalPackage).toContain("detectEphemeral");
    expect(globalPackage).toContain("spawnGlobalInstall");
  });

  it("keeps codealmanac bootstrap process spawning in a named helper", async () => {
    const bootstrap = await readSource("src/platform/install/global.ts");
    const bootstrapProcess = await readSource(
      "src/platform/install/bootstrap-process.ts",
    );

    expect(existsSync(join(ROOT, "src/platform/install/bootstrap-process.ts")))
      .toBe(true);
    expect(bootstrap).toContain("bootstrap-process.js");
    expect(bootstrap).not.toContain("node:child_process");
    expect(bootstrap).not.toContain("stdio: \"inherit\"");
    expect(bootstrap).not.toContain("stdio: [\"ignore\", \"pipe\", \"pipe\"]");
    expect(bootstrap).not.toContain("child.stdout");
    expect(bootstrapProcess).toContain("node:child_process");
    expect(bootstrapProcess).toContain("spawnInheritedProcess");
    expect(bootstrapProcess).toContain("spawnCapturedProcess");
  });

  it("keeps setup provider login process execution in the platform layer", async () => {
    const setupAgentChoice = await readSource(
      "src/edges/cli/setup/agent-choice.ts",
    );
    const setupProviderFixCommand = await readSource(
      "src/services/setup/provider-fix-command.ts",
    );
    const setupServiceIndex = await readSource("src/services/setup/index.ts");
    const platformSetupRuntime = await readSource("src/platform/setup/runtime.ts");
    const platformShell = await readSource("src/platform/shell.ts");

    expect(existsSync(join(ROOT, "src/platform/shell.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/setup/runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/setup/provider-fix-command.ts"))).toBe(true);
    expect(setupAgentChoice).not.toContain("platform/shell.js");
    expect(setupAgentChoice).toContain("platform/setup/runtime.js");
    expect(setupAgentChoice).toContain("runSetupProviderFixCommand");
    expect(setupAgentChoice).not.toContain("node:child_process");
    expect(setupAgentChoice).not.toContain("spawn(command");
    expect(setupAgentChoice).not.toContain("shell: true");
    expect(setupAgentChoice).not.toContain("stdio: \"inherit\"");
    expect(setupProviderFixCommand).not.toContain("platform/");
    expect(setupProviderFixCommand).not.toContain("runInheritedShellCommand");
    expect(setupProviderFixCommand).toContain("SetupProviderFixCommandRunner");
    expect(setupProviderFixCommand).toContain(
      "normalizeSetupProviderFixCommand",
    );
    expect(setupProviderFixCommand).toContain(
      "runnableSetupProviderFixCommand",
    );
    expect(setupServiceIndex).toContain("provider-fix-command.js");
    expect(platformSetupRuntime).toContain("runInheritedShellCommand");
    expect(platformShell).toContain("runInheritedShellCommand");
  });

  it("keeps setup provider and model choice UI separate", async () => {
    const setupAgentChoice = await readSource(
      "src/edges/cli/setup/agent-choice.ts",
    );
    const setupModelChoice = await readSource(
      "src/edges/cli/setup/agent-model-choice.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/setup/agent-model-choice.ts"))).toBe(true);
    expect(setupAgentChoice).toContain("agent-model-choice.js");
    expect(setupAgentChoice).not.toContain("readSetupProviderModelChoices");
    expect(setupAgentChoice).not.toContain("formatModelChoice");
    expect(setupAgentChoice).not.toContain("friendlyModelLabel");
    expect(setupAgentChoice).not.toContain("providerDisplayName");
    expect(setupModelChoice).toContain("readSetupProviderModelChoices");
    expect(setupModelChoice).toContain("formatModelChoice");
  });

  it("keeps setup auto-commit UI out of config persistence mechanics", async () => {
    const autoCommitStep = await readSource(
      "src/edges/cli/setup/auto-commit-step.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/auto-commit.ts"))).toBe(true);
    expect(autoCommitStep).toContain("services/setup/index.js");
    expect(autoCommitStep).not.toContain("../../../config/index");
    expect(autoCommitStep).not.toContain("readConfig");
    expect(autoCommitStep).not.toContain("writeConfig");
  });

  it("keeps setup guide UI out of agent instruction install mechanics", async () => {
    const setupIndex = await readSource("src/edges/cli/setup/index.ts");
    const setupInstructions = await readSource("src/services/setup/instructions.ts");
    const guidesStep = await readSource("src/edges/cli/setup/guides-step.ts");
    const guides = await readSource("src/edges/cli/setup/guides.ts");
    const platformGuides = await readSource("src/platform/install/guides.ts");
    const setupRegistration = await readSource(
      "src/edges/cli/register-setup-commands.ts",
    );
    const targetChoice = await readSource(
      "src/edges/cli/setup/instruction-target-choice.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/instructions.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/install/guides.ts"))).toBe(true);
    expect(setupInstructions).not.toContain(
      "SetupInstructionTargetId = InstructionTargetId",
    );
    expect(setupInstructions).not.toContain(
      "SetupInstructionTarget = InstructionTarget",
    );
    expect(setupInstructions).not.toContain(
      "Promise<AgentInstructionsChange>",
    );
    expect(setupInstructions).not.toContain("homedir");
    expect(setupInstructions).not.toContain("homeDir?: string");
    expect(setupInstructions).toContain("homeDir: string");
    expect(setupInstructions).toContain("guidesDir: string");
    expect(setupInstructions).not.toContain("resolveSetupGuidesDir");
    expect(setupInstructions).not.toContain("createRequire");
    expect(setupInstructions).not.toContain("fileURLToPath");
    expect(setupInstructions).not.toContain("existsSync");
    expect(setupInstructions).toContain(
      "setupInstructionTargetFromAgentTarget",
    );
    expect(platformGuides).toContain("resolveBundledGuidesDir");
    expect(platformGuides).toContain("createRequire");
    expect(platformGuides).toContain("fileURLToPath");
    expect(platformGuides).toContain("existsSync");
    expect(setupRegistration).toContain("resolveBundledGuidesDir()");
    expect(setupIndex).not.toContain("../../../agent");
    for (const source of [setupIndex, guidesStep, guides, targetChoice]) {
      expect(source).toContain("services/setup/index.js");
      expect(source).not.toContain("agent/install-targets");
      expect(source).not.toContain("agent/instructions/codex");
      expect(source).not.toContain("installAgentInstructions");
      expect(source).not.toContain("CLAUDE_IMPORT_LINE");
      expect(source).not.toContain("hasClaudeImportLine");
    }
  });

  it("keeps uninstall UI out of setup cleanup mechanics", async () => {
    const uninstallCommand = await readSource("src/edges/cli/uninstall.ts");
    const uninstallRender = await readSource(
      "src/edges/cli/uninstall-render.ts",
    );
    const setupUninstall = await readSource("src/services/setup/uninstall.ts");
    const setupRegistration = await readSource(
      "src/edges/cli/register-setup-commands.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/uninstall.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/cli/commands/uninstall.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/uninstall-render.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/uninstall.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/uninstall-render.ts"))).toBe(
      true,
    );
    expect(setupUninstall).not.toContain("type AgentInstructionDirs");
    expect(setupUninstall).not.toContain(
      "SetupUninstallOptions extends AgentInstructionDirs",
    );
    expect(uninstallCommand).toContain("services/setup/index.js");
    expect(uninstallCommand).toContain("./uninstall-render.js");
    expect(uninstallCommand).not.toContain("agent/install-targets");
    expect(uninstallCommand).not.toContain("platform/automation/legacy-hooks");
    expect(uninstallCommand).not.toContain("runAutomationUninstall");
    expect(uninstallCommand).not.toContain("removeAgentInstructions");
    expect(uninstallCommand).not.toContain("cleanupLegacyHooks");
    expect(uninstallCommand).not.toContain("Uninstall complete");
    expect(uninstallCommand).not.toContain("Guides removed");
    expect(uninstallCommand).not.toContain("almanac: automation removed");
    expect(uninstallCommand).not.toContain("process.stdout");
    expect(uninstallCommand).not.toContain("process.stdin.isTTY");
    expect(uninstallCommand).not.toContain("process.stdin");
    expect(uninstallCommand).not.toContain("homedir");
    expect(uninstallRender).toContain("renderUninstallResult");
    expect(uninstallRender).toContain("formatAutomationResult");
    expect(uninstallRender).toContain("../../ansi-theme.js");
    expect(uninstallRender).not.toContain("../../ansi.js");
    expect(uninstallRender).toContain("makeAnsiTheme(options.color === true)");
    expect(uninstallCommand).toContain("color?: boolean");
    expect(setupRegistration).toContain("isTTY: process.stdin.isTTY === true");
    expect(setupRegistration).toContain("stdin: process.stdin");
    expect(setupRegistration).toContain("stdout: process.stdout");
  });

  it("keeps setup cleanup services behind automation service cleanup verbs", async () => {
    const setupUninstall = await readSource("src/services/setup/uninstall.ts");

    expect(setupUninstall).toContain("cleanupLegacyAutomationHooks");
    expect(setupUninstall).not.toContain("platform/automation");
  });

  it("keeps sync command adapters out of transcript and absorb workflow mechanics", async () => {
    const syncServiceIndex = await readSource("src/services/sync/index.ts");
    const syncService = await readSource("src/services/sync/sync.ts");
    const syncServiceTypes = await readSource("src/services/sync/types.ts");
    const syncSweep = await readSource("src/services/sync/sweep.ts");
    const syncSweepResults = await readSource("src/services/sync/sweep-results.ts");
    const jobsProviderSessions = await readSource(
      "src/services/jobs/provider-sessions.ts",
    );
    const appCliRuntime = await readSource("src/app/cli-runtime.ts");
    const transcriptDiscovery = await readSource("src/platform/transcripts/index.ts");
    const transcriptRuntime = await readSource("src/platform/transcripts/runtime.ts");
    const sharedTranscripts = await readSource("src/shared/transcripts.ts");
    const syncCommand = await readSource("src/cli/commands/sync.ts");
    const syncRegistration = await readSource(
      "src/edges/cli/register-sync-commands.ts",
    );

    expect(existsSync(join(ROOT, "src/services/sync/types.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/sync/sweep-results.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/transcripts/index.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/transcripts/runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/sync"))).toBe(false);
    expect(syncServiceIndex).not.toContain("../../sync");
    expect(syncService).not.toContain("interface SyncWorkflowOptions");
    expect(syncService).not.toContain("interface SyncWorkflowSummary");
    expect(syncService).not.toContain("homedir");
    expect(syncServiceTypes).toContain("interface SyncWorkflowOptions");
    expect(syncServiceTypes).toContain("homeDir: string");
    expect(syncServiceTypes).not.toContain("homeDir?: string");
    expect(syncServiceTypes).toContain("interface SyncWorkflowSummary");
    expect(syncServiceTypes).toContain("shared/transcripts.js");
    expect(syncService).not.toContain("export type SyncWorkflowSummary = sync.SyncSummary");
    expect(syncService).not.toContain(
      "SyncWorkflowStartedItem extends SyncWorkflowReadyItem",
    );
    expect(syncService).not.toContain("...syncWorkflowReadyItemFromSweep(item)");
    expect(syncService).toContain("syncWorkflowSummaryFromSweep");
    expect(syncService).not.toContain("platform/transcripts");
    expect(syncServiceTypes).toContain("interface SyncTranscriptRuntime");
    expect(syncSweep).not.toContain("platform/transcripts");
    expect(syncSweep).not.toContain("stores/jobs");
    expect(syncSweep).toContain("listJobProviderSessionIds");
    expect(syncSweepResults).not.toContain("platform/transcripts");
    expect(jobsProviderSessions).toContain("listJobRecords");
    expect(syncCommand).not.toContain("platform/transcripts");
    expect(syncRegistration).not.toContain("platform/transcripts");
    expect(syncRegistration).toContain("createCliRuntime");
    expect(appCliRuntime).toContain("createPlatformSyncTranscriptRuntime");
    expect(transcriptRuntime).toContain("discoverTranscriptCandidates");
    expect(transcriptRuntime).toContain("readTranscriptSnapshot");
    expect(transcriptRuntime).toContain("SyncTranscriptRuntime");
    expect(transcriptDiscovery).toContain("discoverTranscriptCandidates");
    expect(transcriptDiscovery).toContain("shared/transcripts.js");
    expect(transcriptDiscovery).not.toContain("operations");
    expect(transcriptDiscovery).not.toContain("stores/sync");
    expect(transcriptDiscovery).not.toContain("services/sync");
    expect(sharedTranscripts).toContain("TranscriptSourceApp");
    expect(syncCommand).toContain("services/sync/index.js");
    expect(syncCommand).not.toContain("../../sync");
    expect(syncCommand).not.toContain("../../operations");
    expect(syncCommand).not.toContain("readConfig");
    expect(syncCommand).not.toContain("parseDuration");
    expect(syncCommand).not.toContain("homedir");
    expect(syncCommand).not.toContain("discoverTranscriptCandidates");
    expect(syncCommand).not.toContain("sync completed");
    expect(syncCommand).not.toContain("providerForRepo");
    expect(syncCommand).not.toContain("syncAbsorbContext");
    expect(syncSweep).not.toContain("interface SyncSummary");
    expect(syncSweep).not.toContain("function cursorContext");
    expect(syncSweep).toContain("syncCursorContext");
    expect(syncSweepResults).toContain("interface SyncSummary");
    expect(syncSweepResults).toContain("syncSkippedSummary");
  });

  it("keeps lifecycle operation command adapters out of run-start mechanics", async () => {
    const lifecycleServiceIndex = await readSource("src/services/lifecycle/index.ts");
    const lifecycleWorkflows = await readSource("src/services/lifecycle/workflows.ts");
    const lifecycleResults = await readSource(
      "src/services/lifecycle/operation-results.ts",
    );
    const lifecycleWorkflowTypes = await readSource(
      "src/services/lifecycle/workflow-types.ts",
    );
    const lifecycleAbsorbIndex = await readSource("src/services/lifecycle/absorb/index.ts");
    const lifecycleAbsorbInput = await readSource("src/services/lifecycle/absorb/input.ts");
    const platformGithubSource = await readSource("src/platform/github/source.ts");
    const platformAbsorbSourceResolver = await readSource("src/platform/sources/absorb.ts");
    const appCliRuntime = await readSource("src/app/cli-runtime.ts");
    const lifecycleCliEdge = await readSource(
      "src/edges/cli/register-lifecycle-run-commands.ts",
    );
    const syncService = await readSource("src/services/sync/sync.ts");
    const operationsCommand = await readSource("src/cli/commands/operations.ts");
    const operationsRender = await readSource("src/cli/commands/operations-render.ts");

    expect(existsSync(join(ROOT, "src/services/lifecycle/operation-results.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/workflows.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/workflow-types.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/operations"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/absorb"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/github/source.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/sources/absorb.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/operations"))).toBe(false);
    expect(existsSync(join(ROOT, "src/absorb"))).toBe(false);
    expect(lifecycleServiceIndex).not.toContain("../../operations");
    expect(lifecycleServiceIndex).toContain("./workflows.js");
    expect(lifecycleWorkflows).not.toContain(
      "LifecycleOperationRunResult = operations.OperationRunResult",
    );
    expect(lifecycleWorkflows).not.toContain("interface LifecycleOperationDeps");
    expect(lifecycleWorkflows).not.toContain(
      "InitOperationWorkflowOptions extends LifecycleOperationDeps",
    );
    expect(lifecycleWorkflows).not.toContain(
      "AbsorbOperationWorkflowOptions extends LifecycleOperationDeps",
    );
    expect(lifecycleWorkflows).not.toContain(
      "GardenOperationWorkflowOptions extends LifecycleOperationDeps",
    );
    expect(lifecycleWorkflows).not.toContain(
      "LifecycleOperationForegroundStarter = operations.StartForegroundJob",
    );
    expect(lifecycleWorkflows).not.toContain(
      "LifecycleOperationBackgroundStarter = operations.StartBackgroundJob",
    );
    expect(lifecycleWorkflows).not.toContain(
      "LifecycleAbsorbSourceResolver = absorb.ResolveSourceFn",
    );
    expect(lifecycleWorkflows).not.toContain("interface LifecycleForegroundStartRequest");
    expect(lifecycleWorkflows).not.toContain("interface InitOperationWorkflowOptions");
    expect(lifecycleWorkflowTypes).toContain("interface LifecycleForegroundStartRequest");
    expect(lifecycleWorkflowTypes).toContain("interface InitOperationWorkflowOptions");
    expect(lifecycleWorkflows).not.toContain(
      "function lifecycleOperationRunResultFromOperation",
    );
    expect(lifecycleWorkflows).toContain("initOperationContext");
    expect(lifecycleWorkflows).toContain("Command context:");
    expect(lifecycleWorkflows).toContain("runPreparedAbsorbOperationWorkflow");
    expect(lifecycleResults).toContain("lifecycleOperationRunResultFromOperation");
    expect(lifecycleResults).toContain("interface LifecycleOperationFailure");
    expect(lifecycleAbsorbIndex).not.toContain("platform/github");
    expect(lifecycleAbsorbInput).not.toContain("platform/github");
    expect(lifecycleAbsorbInput).not.toContain("resolveGitHubSource");
    expect(platformAbsorbSourceResolver).toContain("resolveGitHubSource");
    expect(platformAbsorbSourceResolver).toContain("ResolveSourceFn");
    expect(lifecycleCliEdge).toContain("createCliRuntime");
    expect(lifecycleCliEdge).toContain("resolveSource: runtime.resolveAbsorbSource");
    expect(lifecycleCliEdge).not.toContain("platform/sources");
    expect(appCliRuntime).toContain("createPlatformAbsorbSourceResolver");
    expect(platformGithubSource).not.toContain("services/lifecycle");
    expect(syncService).toContain("runPreparedAbsorbOperationWorkflow");
    expect(syncService).not.toContain("services/lifecycle/operations");
    expect(operationsCommand).toContain("services/lifecycle/index.js");
    expect(operationsRender).not.toContain("../../agent");
    expect(operationsRender).not.toContain("AgentRuntimeFailure");
    expect(operationsCommand).not.toContain("import type { CommandResult }");
    expect(operationsCommand).not.toContain("extends InitOperationWorkflowOptions");
    expect(operationsCommand).not.toContain("extends AbsorbOperationWorkflowOptions");
    expect(operationsCommand).not.toContain("extends GardenOperationWorkflowOptions");
    expect(operationsCommand).not.toContain('["onEvent"]');
    expect(operationsCommand).not.toContain('["startForeground"]');
    expect(operationsCommand).not.toContain('["startBackground"]');
    expect(operationsCommand).not.toContain('["resolveSource"]');
    expect(operationsCommand).toContain("toInitOperationWorkflowOptions");
    expect(operationsCommand).toContain("toAbsorbOperationWorkflowOptions");
    expect(operationsCommand).toContain("toGardenOperationWorkflowOptions");
    expect(operationsCommand).not.toContain("../../services/lifecycle/operations/index");
    expect(operationsCommand).not.toContain("../../absorb");
    expect(operationsCommand).not.toContain("resolveProvider");
    expect(operationsCommand).not.toContain("operations.build");
    expect(operationsCommand).not.toContain("operations.garden");
    expect(operationsCommand).not.toContain("absorb.startRun");
    expect(operationsCommand).not.toContain("initContext");
    expect(operationsCommand).not.toContain("formatInitRequestContext");
    expect(operationsCommand).not.toContain("Command context:");
    expect(operationsCommand).not.toContain("Force requested");
  });

  it("keeps Claude provider protocol mechanics in provider-local modules", async () => {
    const claudeProvider = await readSource("src/agent/runtime/providers/claude.ts");
    const claudeOptions = await readSource(
      "src/agent/runtime/providers/claude/options.ts",
    );

    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/options.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/events.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/failures.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/usage.ts"))).toBe(true);
    expect(claudeProvider).not.toContain("spawnManagedChildProcess");
    expect(claudeProvider).not.toContain("function buildClaudeOptions");
    expect(claudeProvider).not.toContain("function toClaudeAgentRuntimeEvents");
    expect(claudeProvider).not.toContain("function classifyClaudeFailure");
    expect(claudeProvider).not.toContain("function mapClaudeUsage");
    expect(claudeOptions).not.toContain("process.env");
    expect(claudeOptions).toContain("environment: NodeJS.ProcessEnv");
  });

  it("keeps agent runtime provider runtime environment explicit", async () => {
    const registry = await readSource("src/agent/runtime/providers/index.ts");
    const runtimeIndex = await readSource("src/agent/runtime/index.ts");
    const runtimeTypes = await readSource("src/agent/runtime/types.ts");
    const sharedProviderCatalog = await readSource("src/shared/agent-provider.ts");
    const sharedRuntimeEvents = await readSource(
      "src/shared/agent-runtime/events.ts",
    );
    const sharedRuntimeFinalOutput = await readSource(
      "src/shared/agent-runtime/final-output.ts",
    );
    const sharedRuntimeTools = await readSource(
      "src/shared/agent-runtime/tools.ts",
    );
    const runtimeJobRunner = await readSource("src/agent/runtime/job-runner.ts");
    const claudeProvider = await readSource("src/agent/runtime/providers/claude.ts");
    const codexProvider = await readSource("src/agent/runtime/providers/codex.ts");
    const jobAgentRunner = await readSource("src/services/jobs/runtime/agent-runner.ts");
    const jobExecutor = await readSource("src/services/jobs/runtime/executor.ts");
    const jobStart = await readSource("src/services/jobs/runtime/start.ts");
    const jobWorker = await readSource("src/edges/worker/job-worker.ts");
    const queueDrain = await readSource("src/services/jobs/runtime/queue-drain.ts");
    const jobStoreTypes = await readSource("src/stores/jobs/types.ts");
    const jobStoreSpecs = await readSource("src/stores/jobs/specs.ts");
    const sharedOperationSpec = await readSource("src/shared/operation-spec.ts");

    expect(existsSync(join(ROOT, "src/agent/provider-id.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/agent/runtime/events.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/agent/runtime/final-output.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/agent/runtime/tools.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/shared/agent-provider.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/agent-runtime/events.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/shared/agent-runtime/final-output.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/shared/agent-runtime/tools.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/shared/operation-spec.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/operations/spec.ts")))
      .toBe(false);
    expect(sharedProviderCatalog).toContain("ALL_AGENT_PROVIDER_IDS");
    expect(sharedProviderCatalog).toContain("PROVIDER_DEFINITIONS");
    expect(sharedRuntimeEvents).toContain("AgentRuntimeEvent");
    expect(sharedRuntimeEvents).toContain("AgentRuntimeRunHooks");
    expect(sharedRuntimeFinalOutput).toContain("FinalOutputSpec");
    expect(sharedRuntimeTools).toContain("ToolRequest");

    expect(registry).toContain("createAgentRuntimeProviderRegistry");
    expect(registry).toContain("environment: NodeJS.ProcessEnv");
    expect(registry).not.toContain("process.env");
    expect(runtimeIndex).toContain("createAgentRuntimeProviderRegistry");
    expect(runtimeIndex).toContain("../../shared/agent-runtime/events.js");
    expect(runtimeTypes).toContain("../../shared/agent-runtime/events.js");
    expect(runtimeTypes).toContain("OperationSpec");
    expect(runtimeIndex).not.toContain("getAgentRuntimeProvider");
    expect(runtimeIndex).not.toContain("listAgentRuntimeProviders");
    expect(runtimeJobRunner).toContain("createAgentRuntimeJobRunner");
    expect(runtimeJobRunner).toContain("createAgentRuntimeProviderRegistry");
    expect(runtimeJobRunner).toContain("environment: NodeJS.ProcessEnv");
    expect(runtimeJobRunner).not.toContain("services/jobs");
    expect(jobAgentRunner).toContain("export type JobAgentRunner");
    expect(jobAgentRunner).toContain("OperationSpec");
    expect(jobAgentRunner).not.toContain("agent/runtime/types");
    expect(jobStoreTypes).toContain("../../shared/agent-runtime/events.js");
    expect(jobStoreTypes).not.toContain("../../agent/runtime");
    expect(jobStoreTypes).toContain("../../shared/operation-spec.js");
    expect(jobStoreTypes).not.toContain("../../services/lifecycle");
    expect(jobStoreSpecs).toContain("../../shared/operation-spec.js");
    expect(jobStoreSpecs).not.toContain("../../services/lifecycle");
    expect(sharedOperationSpec).toContain("./agent-runtime/final-output.js");
    expect(sharedOperationSpec).not.toContain("../agent/runtime");
    expect(claudeProvider).not.toContain("process.env");
    expect(codexProvider).not.toContain("process.env");
    expect(claudeProvider).not.toContain("claudeAgentRuntimeProvider");
    expect(codexProvider).not.toContain("codexAgentRuntimeProvider");
    expect(jobExecutor).not.toContain("createAgentRuntimeProviderRegistry");
    expect(jobExecutor).not.toContain("workerEnvironment");
    expect(jobExecutor).not.toContain("harnessRun");
    expect(jobExecutor).toContain("agentRunner");
    expect(jobStart).not.toContain("workerEnvironment");
    expect(jobStart).not.toContain("harnessRun");
    expect(jobStart).toContain("agentRunner");
    expect(queueDrain).not.toContain("workerEnvironment");
    expect(queueDrain).not.toContain("harnessRun");
    expect(queueDrain).toContain("agentRunner");
    expect(jobWorker).toContain("createAgentRuntimeJobRunner");
    expect(jobWorker).toContain("workerEnvironment: NodeJS.ProcessEnv");
    expect(jobWorker).toContain("agentRunner?: JobAgentRunner");
  });

  it("keeps job runtime page snapshots behind wiki file stores", async () => {
    const wikiEffects = await readSource("src/services/jobs/runtime/wiki-effects.ts");
    const pageSnapshots = await readSource(
      "src/stores/wiki-files/page-snapshots.ts",
    );

    expect(existsSync(join(ROOT, "src/services/jobs/runtime/snapshots.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/stores/wiki-files/page-snapshots.ts"))).toBe(
      true,
    );
    expect(wikiEffects).toContain("snapshotWikiPages");
    expect(wikiEffects).toContain("diffPageSnapshots");
    expect(wikiEffects).not.toContain("node:fs");
    expect(wikiEffects).not.toContain("\"node:path\"");
    expect(wikiEffects).not.toContain(".almanac");
    expect(wikiEffects).not.toContain("readFile");
    expect(wikiEffects).not.toContain("readdir");
    expect(pageSnapshots).toContain("node:fs");
    expect(pageSnapshots).toContain("readFile");
    expect(pageSnapshots).toContain("parseFrontmatter");
  });

  it("passes agent readiness runtime facts through an explicit context", async () => {
    const agentTypes = await readSource("src/agent/types.ts");
    const configProviders = await readSource("src/agent/provider-enablement.ts");
    const readinessView = await readSource("src/agent/readiness/view.ts");
    const readinessStatus = await readSource(
      "src/agent/readiness/providers/status.ts",
    );
    const claudeReadiness = await readSource(
      "src/agent/readiness/providers/claude/index.ts",
    );
    const claudeAuth = await readSource("src/agent/auth/claude.ts");

    expect(agentTypes).toContain("export interface AgentProviderRuntime");
    expect(agentTypes).toContain("environment: NodeJS.ProcessEnv");
    expect(agentTypes).toContain("checkStatus(runtime: AgentProviderRuntime)");
    expect(configProviders).not.toContain("process.env");
    expect(configProviders).toContain("isCursorEnabled(env: NodeJS.ProcessEnv)");
    expect(configProviders).toContain("getEnabledAgentProviderIds(\n  env: NodeJS.ProcessEnv");
    expect(readinessStatus).toContain("providerRuntime(args)");
    expect(readinessView).not.toContain("process.env");
    expect(claudeReadiness).not.toContain("process.env");
    expect(claudeAuth).not.toContain("process.env");
    expect(claudeReadiness).toContain("runtime.environment.ANTHROPIC_API_KEY");
    expect(claudeAuth).toContain("environment.ANTHROPIC_API_KEY");
  });

  it("keeps Codex app-server policy out of the JSON-RPC run loop", async () => {
    const appServer = await readSource("src/agent/runtime/providers/codex/app-server.ts");
    const request = await readSource("src/agent/runtime/providers/codex/request.ts");
    const appServerRpc = await readSource(
      "src/agent/runtime/providers/codex/app-server-rpc.ts",
    );
    const appServerSession = await readSource(
      "src/agent/runtime/providers/codex/app-server-session.ts",
    );
    const appServerRootTurn = await readSource(
      "src/agent/runtime/providers/codex/app-server-root-turn.ts",
    );

    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-server-config.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/server-requests.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-server-session.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-server-rpc.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-server-root-turn.ts"))).toBe(true);
    expect(appServer).not.toContain("CODEALMANAC_CODEX_APP_SERVER");
    expect(appServer).not.toContain("function parsePositiveEnvInt");
    expect(appServer).not.toContain("interface PendingRequest");
    expect(appServer).not.toContain("pending.set");
    expect(appServer).not.toContain("function handleResponse");
    expect(appServer).not.toContain("Almanac does not handle Codex app-server request");
    expect(appServer).not.toContain("case \"item/commandExecution/requestApproval\"");
    expect(appServer).not.toContain("case \"account/chatgptAuthTokens/refresh\"");
    expect(appServer).not.toContain("codexClientVersion");
    expect(appServer).not.toContain("combineCodexPrompt");
    expect(appServer).not.toContain("codexAppServerSandboxPolicy");
    expect(appServer).not.toContain("requestRpc(\"initialize\"");
    expect(appServer).not.toContain("requestRpc(\"thread/start\"");
    expect(appServer).not.toContain("requestRpc(\"turn/start\"");
    expect(appServer).not.toContain("function isRootTurnCompletion");
    expect(appServer).not.toContain("function isRootThreadNotification");
    expect(appServerSession).toContain("startCodexAppServerTurn");
    expect(appServerSession).toContain("requestRpc(\"initialize\"");
    expect(appServerSession).toContain("requestRpc(\"thread/start\"");
    expect(appServerSession).toContain("requestRpc(\"turn/start\"");
    expect(appServerRpc).toContain("interface PendingRequest");
    expect(appServerRpc).toContain("pending.set");
    expect(appServerRpc).toContain("function handleResponse");
    expect(appServerRootTurn).toContain("isCodexRootTurnCompletion");
    expect(appServerRootTurn).toContain("isCodexRootThreadNotification");
    expect(request).not.toContain("process.env");
    expect(request).toContain("environment: NodeJS.ProcessEnv");
  });

  it("keeps migrate legacy-sources adapter out of source migration mechanics", async () => {
    const migrateCommand = await readSource("src/cli/commands/migrate.ts");
    const migrateRender = await readSource("src/cli/commands/migrate-render.ts");
    const sourceMigrationService = await readSource(
      "src/services/wiki/source-migration.ts",
    );
    const wikiSources = await readSource("src/stores/wiki/sources/index.ts");
    const wikiSourcesFrontmatterFix = await readSource(
      "src/stores/wiki/sources/frontmatter-fix.ts",
    );
    const wikiSourcesMaintenance = await readSource(
      "src/stores/wiki/sources/maintenance.ts",
    );

    expect(existsSync(join(ROOT, "src/stores/wiki/sources/frontmatter-fix.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/cli/commands/migrate-render.ts"))).toBe(
      true,
    );
    expect(migrateCommand).toContain("services/wiki/source-migration.js");
    expect(migrateCommand).toContain("services/automation/index.js");
    expect(migrateCommand).toContain("./migrate-render.js");
    expect(migrateCommand).not.toContain("stores/wiki/indexer");
    expect(migrateCommand).not.toContain("stores/wiki/sources");
    expect(migrateCommand).not.toContain("platform/automation");
    expect(migrateCommand).not.toContain("./automation.js");
    expect(migrateCommand).not.toContain("resolveWikiRoot");
    expect(migrateCommand).not.toContain("migrateLegacySourceFrontmatter");
    expect(migrateCommand).not.toContain("detectLegacyCaptureSweepAutomation");
    expect(migrateCommand).not.toContain("removeLaunchdJob");
    expect(migrateCommand).not.toContain("runAutomationInstall");
    expect(migrateCommand).not.toContain("JSON.stringify");
    expect(migrateCommand).not.toContain("renderOutcome");
    expect(migrateCommand).not.toContain("migrated automation to sync");
    expect(migrateCommand).not.toContain("no migratable legacy source");
    expect(migrateRender).toContain("renderMigrateLegacySources");
    expect(migrateRender).toContain("renderMigrateAutomation");
    expect(migrateRender).toContain("renderAutomationInstallFailure");
    expect(sourceMigrationService).not.toContain(
      "export type MigrateLegacySourcesResult = LegacySourceMigrationResult",
    );
    expect(wikiSources).not.toContain("MigrateLegacySources");
    expect(wikiSourcesMaintenance).not.toContain("MigrateLegacySources");
    expect(wikiSourcesMaintenance).not.toContain("yaml.load");
    expect(wikiSourcesMaintenance).not.toContain("function splitFrontmatter");
    expect(wikiSourcesMaintenance).not.toContain("function idFromPath");
    expect(wikiSourcesFrontmatterFix).toContain("applySourceFrontmatterFix");
    expect(wikiSourcesFrontmatterFix).toContain("function splitFrontmatter");
  });

  it("keeps automation command options owned by the command adapter", async () => {
    const automationCommand = await readSource("src/cli/commands/automation.ts");

    expect(automationCommand).toContain("AutomationInstallCommandOptions");
    expect(automationCommand).toContain("cwd: string");
    expect(automationCommand).toContain("homeDir: string");
    expect(automationCommand).toContain("pathEnvironment: string | undefined");
    expect(automationCommand).toContain("toAutomationInstallOptions");
    expect(automationCommand).not.toContain(
      "AutomationOptions = AutomationInstallOptions & AutomationUninstallOptions",
    );
    expect(automationCommand).not.toContain("export type { AutomationStatusOptions }");
  });

  it("keeps indexer page planning out of SQLite write orchestration", async () => {
    const indexer = await readSource("src/stores/wiki/indexer/index.ts");
    const pagePlan = await readSource("src/stores/wiki/indexer/page-plan.ts");
    const pageWriter = await readSource("src/stores/wiki/indexer/page-writer.ts");
    const frontmatter = await readSource("src/stores/wiki/indexer/frontmatter.ts");
    const topicsYaml = await readSource("src/stores/wiki/indexer/topics-yaml.ts");

    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/page-plan.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/page-writer.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/warnings.ts"))).toBe(true);
    expect(indexer).toContain("buildIndexedPagesPlan");
    expect(indexer).toContain("applyIndexedPagesPlan");
    expect(indexer).not.toContain("fast-glob");
    expect(indexer).not.toContain("readFile");
    expect(indexer).not.toContain("statSync");
    expect(indexer).not.toContain("createHash");
    expect(indexer).not.toContain("parseFrontmatter");
    expect(indexer).not.toContain("normalizePageSources");
    expect(indexer).not.toContain("extractWikilinks");
    expect(indexer).not.toContain("INSERT INTO pages");
    expect(indexer).not.toContain("DELETE FROM file_refs");
    expect(indexer).not.toContain("normalizePath");
    expect(pagePlan).toContain("fast-glob");
    expect(pagePlan).toContain("parseFrontmatter");
    expect(pagePlan).toContain("normalizePageSources");
    expect(pageWriter).toContain("INSERT INTO pages");
    expect(pageWriter).toContain("DELETE FROM file_refs");
    expect(pageWriter).toContain("normalizePath");
    expect(indexer).not.toContain("process.stderr");
    expect(pagePlan).not.toContain("process.stderr");
    expect(frontmatter).not.toContain("process.stderr");
    expect(topicsYaml).not.toContain("process.stderr");
  });

  it("keeps frontmatter source coercion separate from document parsing", async () => {
    const frontmatter = await readSource("src/stores/wiki/indexer/frontmatter.ts");
    const frontmatterSources = await readSource(
      "src/stores/wiki/indexer/frontmatter-sources.ts",
    );
    const pageSources = await readSource("src/stores/wiki/indexer/page-sources.ts");

    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/frontmatter-sources.ts"))).toBe(true);
    expect(frontmatter).toContain("frontmatter-sources.js");
    expect(frontmatter).not.toContain("function coerceSource");
    expect(frontmatter).not.toContain("case \"conversation\"");
    expect(frontmatter).not.toContain("coerceDateString");
    expect(frontmatterSources).toContain("export type FrontmatterSource");
    expect(frontmatterSources).toContain("export function coerceFrontmatterSources");
    expect(pageSources).toContain("frontmatter-sources.js");
  });

  it("keeps doctor diagnostics out of the CLI command package", async () => {
    const doctorIndex = await readSource("src/cli/commands/doctor/index.ts");
    const doctorRender = await readSource("src/cli/commands/doctor/render.ts");
    const doctorFormat = await readSource("src/cli/commands/doctor/format.ts");
    const doctorDiagnostics = await readSource("src/services/diagnostics/doctor.ts");
    const installDiagnostics = await readSource("src/services/diagnostics/install.ts");
    const platformAuthDiagnostics = await readSource(
      "src/platform/diagnostics/auth.ts",
    );
    const platformInstallDiagnostics = await readSource(
      "src/platform/diagnostics/install.ts",
    );
    const platformAutomationDiagnostics = await readSource(
      "src/platform/diagnostics/automation.ts",
    );
    const platformInstructionDiagnostics = await readSource(
      "src/platform/diagnostics/instructions.ts",
    );
    const platformUpdateDiagnostics = await readSource(
      "src/platform/diagnostics/updates.ts",
    );
    const sharedDiagnosticTypes = await readSource(
      "src/shared/diagnostics.ts",
    );
    const updateDiagnostics = await readSource("src/services/diagnostics/updates.ts");
    const diagnosticsTypes = await readSource("src/services/diagnostics/types.ts");
    const diagnosticsIndex = await readSource("src/services/diagnostics/index.ts");
    const setupRegistration = await readSource(
      "src/edges/cli/register-setup-commands.ts",
    );
    const doctorService = await readSource("src/services/wiki/doctor.ts");
    const doctorTypes = await readSource("src/services/wiki/doctor-types.ts");
    const doctorHealth = await readSource("src/services/wiki/doctor-health.ts");
    const doctorIndexService = await readSource(
      "src/services/wiki/doctor-index.ts",
    );
    const doctorAbsorbService = await readSource(
      "src/services/wiki/doctor-absorb.ts",
    );
    const indexDiagnostics = await readSource(
      "src/stores/wiki/indexer/diagnostics.ts",
    );
    const absorbLogFiles = await readSource(
      "src/stores/wiki-files/absorb-logs.ts",
    );

    expect(existsSync(join(ROOT, "src/cli/commands/doctor/render.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/services/diagnostics/probes.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/platform/diagnostics/install.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/platform/diagnostics/types.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/shared/diagnostics.ts"))).toBe(
      true,
    );
    expect(doctorIndex).toContain("services/diagnostics/index.js");
    expect(doctorIndex).toContain("./render.js");
    expect(doctorIndex).not.toContain("./install.js");
    expect(doctorIndex).not.toContain("./agents.js");
    expect(doctorIndex).not.toContain("./updates.js");
    expect(doctorIndex).not.toContain("./probes.js");
    expect(doctorIndex).not.toContain("formatReport");
    expect(doctorIndex).not.toContain("JSON.stringify");
    expect(doctorIndex).not.toContain("agent/");
    expect(doctorIndex).not.toContain("platform/");
    expect(doctorIndex).not.toContain("readConfig");
    expect(doctorIndex).not.toContain("readStateForDoctor");
    expect(doctorRender).toContain("renderDoctorReport");
    expect(doctorRender).toContain("formatReport");
    expect(doctorFormat).not.toContain("process.stdout");
    expect(doctorFormat).toContain("../../../ansi-theme.js");
    expect(doctorFormat).not.toContain("../../../ansi.js");
    expect(doctorFormat).toContain("makeAnsiTheme(options.color === true)");
    expect(doctorFormat).not.toContain("DoctorOptions");
    expect(diagnosticsTypes).not.toContain("stdout?:");
    expect(diagnosticsTypes).toContain("claudeApiKeySet: boolean");
    expect(diagnosticsTypes).toContain("nodeVersion: string");
    expect(diagnosticsTypes).toContain("authStatus: DiagnosticsAuthStatus");
    expect(diagnosticsTypes).toContain("automationStatus: DiagnosticsAutomationStatus");
    expect(diagnosticsTypes).toContain("guideStatus: DiagnosticsGuideStatus");
    expect(diagnosticsTypes).toContain(
      "instructionEntriesStatus: DiagnosticsInstructionEntriesStatus",
    );
    expect(diagnosticsTypes).toContain("updateStatus: DiagnosticsUpdateStatus");
    expect(diagnosticsTypes).toContain("installStatus: DiagnosticsInstallStatus");
    expect(diagnosticsTypes).not.toContain("settingsPath?:");
    expect(diagnosticsTypes).not.toContain("almanacDir?:");
    expect(diagnosticsTypes).not.toContain("hookScriptPath?:");
    expect(diagnosticsTypes).not.toContain("updateStatePath?:");
    expect(diagnosticsTypes).not.toContain("updateConfigPath?:");
    expect(diagnosticsTypes).not.toContain("installPath?:");
    expect(diagnosticsTypes).not.toContain("versionOverride?:");
    expect(diagnosticsTypes).not.toContain("sqliteProbe?:");
    expect(doctorDiagnostics).not.toContain("readPackageVersion");
    expect(installDiagnostics).not.toContain("process.env");
    expect(installDiagnostics).not.toContain("process.version");
    expect(installDiagnostics).not.toContain("platform/automation");
    expect(installDiagnostics).not.toContain("homedir");
    expect(installDiagnostics).not.toContain("existsSync");
    expect(installDiagnostics).not.toContain("probeBetterSqlite3");
    expect(installDiagnostics).not.toContain("detectInstallPath");
    expect(installDiagnostics).not.toContain("checkAgentInstructions");
    expect(installDiagnostics).not.toContain("safeCheckAuth");
    expect(installDiagnostics).not.toContain("checkClaudeAuth");
    expect(updateDiagnostics).not.toContain("../../config/");
    expect(updateDiagnostics).not.toContain("../../platform/");
    expect(updateDiagnostics).not.toContain("readState");
    expect(updateDiagnostics).not.toContain("readConfig");
    expect(updateDiagnostics).not.toContain("readStateForDoctor");
    expect(setupRegistration).toContain("shouldUseStdoutColor()");
    expect(setupRegistration).toContain("nodeVersion: process.version");
    expect(setupRegistration).toContain("probeDiagnosticInstall({ homeDir: homedir() })");
    expect(setupRegistration).toContain("probeDiagnosticClaudeAuth()");
    expect(setupRegistration).toContain("probeDiagnosticAutomation()");
    expect(setupRegistration).toContain("probeDiagnosticGuides()");
    expect(setupRegistration).toContain("probeDiagnosticInstructionEntries()");
    expect(setupRegistration).toContain("probeDiagnosticUpdates()");
    expect(setupRegistration).not.toContain("color: process.stdout.isTTY === true");
    expect(platformAuthDiagnostics).toContain("checkClaudeAuth");
    expect(platformInstallDiagnostics).toContain("probeBetterSqlite3");
    expect(platformInstallDiagnostics).toContain("readPackageVersion");
    expect(platformInstallDiagnostics).toContain("homedir()");
    expect(platformAutomationDiagnostics).toContain(
      "../automation/legacy-capture.js",
    );
    expect(platformAutomationDiagnostics).toContain("../automation/paths.js");
    expect(platformInstructionDiagnostics).toContain("checkAgentInstructions");
    expect(platformInstructionDiagnostics).toContain("homedir()");
    expect(platformUpdateDiagnostics).toContain("readState");
    expect(platformUpdateDiagnostics).toContain("readConfig");
    for (const platformDiagnostics of [
      platformAuthDiagnostics,
      platformInstallDiagnostics,
      platformAutomationDiagnostics,
      platformInstructionDiagnostics,
      platformUpdateDiagnostics,
    ]) {
      expect(platformDiagnostics).not.toContain("services/diagnostics");
    }
    expect(sharedDiagnosticTypes).toContain("DiagnosticsInstallStatus");
    expect(sharedDiagnosticTypes).toContain("SqliteProbeResult");
    expect(sharedDiagnosticTypes).toContain("DiagnosticsSpawnCliFn");
    expect(sharedDiagnosticTypes).not.toContain("platform/");
    expect(sharedDiagnosticTypes).not.toContain("services/");
    expect(platformInstallDiagnostics).toContain("../../shared/diagnostics.js");
    expect(diagnosticsTypes).toContain("../../shared/diagnostics.js");
    expect(diagnosticsTypes).not.toContain("../../platform/diagnostics/types.js");
    expect(existsSync(join(ROOT, "src/platform/update/semver.ts"))).toBe(false);
    expect(diagnosticsTypes).not.toContain("agent/readiness/providers/claude");
    expect(diagnosticsTypes).not.toContain("from \"../../agent/types.js\"");
    expect(diagnosticsTypes).not.toContain("from \"../../stores/config/index.js\"");
    expect(diagnosticsTypes).not.toContain("DiagnosticsSpawnCliFn = SpawnCliFn");
    expect(diagnosticsTypes).not.toContain(
      "DiagnosticsSpawnedProcess = SpawnedProcess",
    );
    expect(diagnosticsTypes).not.toContain(
      "DiagnosticsProviderStatus = ProviderStatus",
    );
    expect(diagnosticsTypes).not.toContain(
      "DiagnosticsAgentProviderId = AgentProviderId",
    );
    expect(diagnosticsIndex).not.toContain("../../agent/");
    expect(diagnosticsIndex).not.toContain("../../config/");
    expect(doctorTypes).not.toContain("typeof collectHealthReport");
    expect(doctorHealth).not.toContain("../../stores/wiki/health/index");
    expect(doctorHealth).toContain("collectWikiHealthReport");
    expect(doctorService).toContain("readWikiIndexDiagnostics");
    expect(doctorDiagnostics).toContain("../wiki/doctor.js");
    expect(existsSync(join(ROOT, "src/services/diagnostics/doctor.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/diagnostics.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/install.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/agents.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/updates.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/probes.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/types.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/wiki.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/duration.ts"))).toBe(false);

    expect(doctorService).not.toContain("readdirSync");
    expect(doctorService).not.toContain("statSync");
    expect(doctorService).not.toContain("openIndex");
    expect(doctorService).not.toContain("findEntry");
    expect(doctorService).not.toContain("collectHealthReport");
    expect(doctorIndexService).not.toContain("existsSync");
    expect(doctorIndexService).not.toContain("statSync");
    expect(doctorIndexService).not.toContain("openIndex");
    expect(doctorIndexService).not.toContain("better-sqlite3");
    expect(doctorIndexService).not.toContain("SELECT COUNT");
    expect(doctorAbsorbService).toContain("findLatestAbsorbLogFile");
    expect(doctorAbsorbService).not.toContain("node:fs");
    expect(doctorAbsorbService).not.toContain("readdirSync");
    expect(doctorAbsorbService).not.toContain("statSync");
    expect(absorbLogFiles).toContain("readdirSync");
    expect(absorbLogFiles).toContain("statSync");
    expect(absorbLogFiles).toContain("findLatestAbsorbLogFile");
    expect(indexDiagnostics).toContain("openIndex");
    expect(indexDiagnostics).toContain("existsSync");
    expect(indexDiagnostics).toContain("statSync");
    expect(indexDiagnostics).toContain("WikiIndexDiagnostics");
  });

  it("keeps registry persistence in an explicit store", async () => {
    const autoRegistration = await readSource(
      "src/services/wiki/autoregistration.ts",
    );

    expect(existsSync(join(ROOT, "src/stores/wiki-registry/store.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/registry/store.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/stores/wiki/registry/index.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/stores/wiki/registry"))).toBe(false);
    expect(autoRegistration).toContain("findRegistryEntry");
    expect(autoRegistration).not.toContain("existsSync");
    expect(autoRegistration).not.toContain("node:fs");
    expect(autoRegistration).not.toContain("process.platform");
    expect(autoRegistration).not.toContain("function samePath");
    expect(autoRegistration).not.toContain("toLowerCase()");
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}

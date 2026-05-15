import { dirname, join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import type { CommandResult } from "../cli/helpers.js";
import { renderOutcome } from "../cli/outcome.js";
import type { HarnessEvent } from "../harness/events.js";
import type { HarnessProviderId } from "../harness/types.js";
import { runAbsorbOperation } from "../operations/absorb.js";
import { runBuildOperation } from "../operations/build.js";
import { runGardenOperation } from "../operations/garden.js";
import { readConfig } from "../update/config.js";
import { findNearestAlmanacDir } from "../paths.js";
import { ComposioClient } from "../connectors/composio.js";
import { NotionConnector } from "../connectors/notion.js";
import { NotionCliConnector } from "../connectors/notion-cli.js";
import type { NotionSelector } from "../connectors/types.js";
import { setConnectorConnection } from "../connectors/store.js";
import { createRunId, runsDir } from "../process/index.js";
import {
  ConnectorNeedsActionError,
  requireConnectorConnection,
} from "./connectors.js";
import { resolveCaptureTranscripts } from "./session-transcripts.js";
import type {
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundProcess,
  StartForegroundProcess,
} from "../operations/types.js";

export interface OperationCommandDeps {
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
}

export interface InitCommandOptions extends OperationCommandDeps {
  cwd: string;
  using?: string;
  background?: boolean;
  json?: boolean;
  force?: boolean;
  yes?: boolean;
}

export interface CaptureCommandOptions extends OperationCommandDeps {
  cwd: string;
  sessionFiles?: string[];
  app?: string;
  session?: string;
  since?: string;
  limit?: number;
  all?: boolean;
  allApps?: boolean;
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
  claudeProjectsDir?: string;
  contextNote?: string;
}

export interface IngestCommandOptions extends OperationCommandDeps {
  cwd: string;
  paths: string[];
  notionPage?: string;
  notionQuery?: string;
  notionDataSource?: string;
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
  notionConnector?: NotionConnector | NotionCliConnector;
  notionComposio?: ComposioClient;
}

export interface GardenCommandOptions extends OperationCommandDeps {
  cwd: string;
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
}

export async function runInitCommand(
  options: InitCommandOptions,
): Promise<CommandResult> {
  const provider = await resolveProviderOrOutcome(options);
  if ("error" in provider) return provider.error;
  const background = options.background === true;
  if (options.json === true && !background) return jsonForegroundError(options.json);

  try {
    const result = await runBuildOperation({
      cwd: options.cwd,
      provider: provider.value,
      background,
      context: initContext(options),
      force: options.force,
      onEvent: options.onEvent,
      startForeground: options.startForeground,
      startBackground: options.startBackground,
    });
    return renderOperationResult("init", result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

export async function runCaptureCommand(
  options: CaptureCommandOptions,
): Promise<CommandResult> {
  const provider = await resolveProviderOrOutcome(options);
  if ("error" in provider) return provider.error;
  if (options.json === true && options.foreground === true) {
    return jsonForegroundError(options.json);
  }

  try {
    const repoRoot = await resolveCaptureRepoRoot(options.cwd, options.json);
    if (typeof repoRoot !== "string") return repoRoot;
    const resolved = await resolveCaptureTranscripts({
      repoRoot,
      cwd: options.cwd,
      files: options.sessionFiles,
      app: options.app,
      session: options.session,
      since: options.since,
      limit: options.limit,
      all: options.all,
      allApps: options.allApps,
      claudeProjectsDir: options.claudeProjectsDir,
    });
    if (!resolved.ok) {
      return renderOutcome(
        {
          type: "needs-action",
          message: resolved.error,
          fix: resolved.fix,
          data: {
            app: options.app,
            session: options.session,
            since: options.since,
            limit: options.limit,
            all: options.all,
            allApps: options.allApps,
          },
        },
        { json: options.json },
      );
    }
    const paths = resolved.paths;
    const result = await runAbsorbOperation({
      cwd: options.cwd,
      provider: provider.value,
      background: options.foreground !== true,
      context: captureContext({ ...options, sessionFiles: paths }),
      targetKind: "session",
      targetPaths: paths,
      onEvent: options.onEvent,
      startForeground: options.startForeground,
      startBackground: options.startBackground,
    });
    return renderOperationResult("capture", result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

export async function runIngestCommand(
  options: IngestCommandOptions,
): Promise<CommandResult> {
  const provider = await resolveProviderOrOutcome(options);
  if ("error" in provider) return provider.error;
  if (options.paths.length === 0) {
    return renderOutcome(
      { type: "error", message: "ingest requires at least one file or folder" },
      { json: options.json },
    );
  }
  if (options.json === true && options.foreground === true) {
    return jsonForegroundError(options.json);
  }

  try {
    if (isNotionIngest(options)) {
      return await runNotionIngestCommand(options, provider.value);
    }
    if (hasNotionSelectorOption(options)) {
      return renderOutcome(
        {
          type: "error",
          message:
            'Notion selector options require path "notion"; run: almanac ingest notion --query "..."',
        },
        { json: options.json },
      );
    }
    const paths = options.paths.map((path) => resolve(options.cwd, path));
    const result = await runAbsorbOperation({
      cwd: options.cwd,
      provider: provider.value,
      background: options.foreground !== true,
      context: ingestContext(paths),
      targetKind: "path",
      targetPaths: paths,
      onEvent: options.onEvent,
      startForeground: options.startForeground,
      startBackground: options.startBackground,
    });
    return renderOperationResult("ingest", result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

async function runNotionIngestCommand(
  options: IngestCommandOptions,
  provider: OperationProviderSelection,
): Promise<CommandResult> {
  const repoRoot = findNearestAlmanacDir(options.cwd);
  if (repoRoot === null) {
    return renderOutcome(
      {
        type: "needs-action",
        message: "no .almanac/ found in this directory or any parent",
        fix: "run: almanac init",
      },
      { json: options.json },
    );
  }
  const selector = notionSelectorFromOptions(options);
  const connector = options.notionConnector ?? await createNotionConnector({
    composio: options.notionComposio,
  });
  const bundle = await connector.fetchBundle(selector);
  if (bundle.documents.length === 0) {
    return renderOutcome(
      {
        type: "noop",
        message: `No Notion documents matched the ${bundle.selector.kind} selector; nothing to ingest.`,
        data: {
          connector: "notion",
          selector: bundle.selector,
          fetchedAt: bundle.fetchedAt,
          candidateCount: bundle.candidates?.length ?? 0,
        },
      },
      { json: options.json },
    );
  }
  const background = options.foreground !== true;
  const artifact = background
    ? await writeNotionSourceArtifact(repoRoot, bundle)
    : undefined;
  const result = await runAbsorbOperation({
    cwd: repoRoot,
    provider,
    background,
    context: notionIngestContext(bundle, { artifactPath: artifact?.path }),
    targetKind: "connector:notion",
    targetPaths: bundle.documents.map((document) => document.url ?? document.id),
    runId: artifact?.runId,
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
  });
  return renderOperationResult("ingest", result, options.json);
}

export async function runGardenCommand(
  options: GardenCommandOptions,
): Promise<CommandResult> {
  const provider = await resolveProviderOrOutcome(options);
  if ("error" in provider) return provider.error;
  if (options.json === true && options.foreground === true) {
    return jsonForegroundError(options.json);
  }

  try {
    const result = await runGardenOperation({
      cwd: options.cwd,
      provider: provider.value,
      background: options.foreground !== true,
      onEvent: options.onEvent,
      startForeground: options.startForeground,
      startBackground: options.startBackground,
    });
    return renderOperationResult("garden", result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

export function parseUsing(value: string | undefined): OperationProviderSelection {
  if (value === undefined || value.trim().length === 0) {
    return { id: "codex" };
  }
  const [rawProvider, ...modelParts] = value.split("/");
  if (!isProviderId(rawProvider)) {
    throw new Error(
      `invalid --using "${value}" (expected claude, codex, or cursor)`,
    );
  }
  const model = modelParts.join("/");
  return {
    id: rawProvider,
    model: model.length > 0 ? model : undefined,
  };
}

async function resolveProviderOrOutcome(
  options: {
    cwd: string;
    using?: string;
    json?: boolean;
  },
): Promise<{ value: OperationProviderSelection } | { error: CommandResult }> {
  try {
    if (options.using !== undefined) {
      return { value: parseUsing(options.using) };
    }
    const config = await readConfig({ cwd: options.cwd });
    const id = config.agent.default;
    const model = config.agent.models[id] ?? undefined;
    return { value: { id, model: model ?? undefined } };
  } catch (err: unknown) {
    return {
      error: renderOutcome(
        { type: "error", message: err instanceof Error ? err.message : String(err) },
        { json: options.json },
      ),
    };
  }
}

function isProviderId(value: string | undefined): value is HarnessProviderId {
  return value === "claude" || value === "codex" || value === "cursor";
}

function renderOperationResult(
  operation: string,
  result: OperationRunResult,
  json: boolean | undefined,
): CommandResult {
  const record = result.background?.record ?? result.foreground?.record;
  const status = record?.status;
  const foregroundResult = result.foreground?.result;
  if (
    result.mode === "foreground" &&
    (foregroundResult?.success === false || status === "failed")
  ) {
    const failure = foregroundResult?.failure ?? record?.failure;
    return renderOutcome(
      {
        type: "error",
        message: renderOperationFailureMessage({
          operation,
          runId: result.runId,
          error: foregroundResult?.error,
          failure,
        }),
        data: {
          operation,
          runId: result.runId,
          mode: result.mode,
          status,
          pid: record?.pid,
          logPath: record?.logPath,
          error: foregroundResult?.error,
          failure,
        },
      },
      { json },
    );
  }
  const message = result.mode === "background"
    ? `${operation} started: ${result.runId}`
    : `${operation} finished: ${result.runId}`;
  const stdout = operation === "init" && result.mode === "foreground"
    ? `${message}\nBrowse the wiki: almanac serve\n`
    : undefined;

  return renderOutcome(
    {
      type: "success",
      message,
      data: {
        operation,
        runId: result.runId,
        mode: result.mode,
        status,
        pid: record?.pid,
        logPath: record?.logPath,
      },
    },
    { json, stdout },
  );
}

function renderOperationFailureMessage(args: {
  operation: string;
  runId: string;
  error?: string;
  failure?: import("../harness/events.js").HarnessFailure;
}): string {
  const lines = [`${args.operation} failed: ${args.runId}`];
  if (args.failure !== undefined) {
    lines.push(`Reason: ${args.failure.message}`);
    if (args.failure.fix !== undefined) lines.push(`Fix: ${args.failure.fix}`);
    return lines.join("\n");
  }
  if (args.error !== undefined) lines[0] += `: ${args.error}`;
  return lines.join("\n");
}

function renderOperationError(
  err: unknown,
  json: boolean | undefined,
): CommandResult {
  if (err instanceof ConnectorNeedsActionError) {
    return renderOutcome(
      { type: "needs-action", message: err.message, fix: err.fix },
      { json },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("no .almanac/")) {
    return renderOutcome(
      {
        type: "needs-action",
        message,
        fix: "run: almanac init",
      },
      { json },
    );
  }
  return renderOutcome({ type: "error", message }, { json });
}

async function resolveCaptureRepoRoot(
  cwd: string,
  json: boolean | undefined,
): Promise<string | CommandResult> {
  const { findNearestAlmanacDir } = await import("../paths.js");
  const repoRoot = findNearestAlmanacDir(cwd);
  if (repoRoot !== null) return repoRoot;
  return renderOutcome(
    {
      type: "needs-action",
      message: "no .almanac/ found in this directory or any parent",
      fix: "run: almanac init",
    },
    { json },
  );
}

function jsonForegroundError(json: boolean | undefined): CommandResult {
  return renderOutcome({
    type: "error",
    message: "--json is only supported for background job start responses",
  }, { json });
}

function initContext(options: InitCommandOptions): string {
  return [
    "Command context:",
    `- Command: init`,
    `- Force requested: ${options.force === true ? "yes" : "no"}`,
    `- Non-interactive confirmation: ${options.yes === true ? "yes" : "no"}`,
  ].join("\n");
}

function captureContext(options: CaptureCommandOptions): string {
  const lines = ["Command context:", "- Command: capture"];
  if (options.app !== undefined) lines.push(`- App: ${options.app}`);
  if (options.session !== undefined) lines.push(`- Session id: ${options.session}`);
  if (options.since !== undefined) lines.push(`- Since: ${options.since}`);
  if (options.limit !== undefined) lines.push(`- Limit: ${options.limit}`);
  if (options.all === true) lines.push("- Capture all matching sessions");
  if (options.allApps === true) lines.push("- Capture all supported apps");
  const paths = options.sessionFiles ?? [];
  if (paths.length > 0) {
    lines.push("- Session/transcript files:");
    for (const path of paths) lines.push(`  - ${path}`);
  }
  if (paths.length === 0 && options.session === undefined) {
    lines.push("- No explicit session file or session id was provided.");
  }
  if (options.contextNote !== undefined && options.contextNote.trim().length > 0) {
    lines.push("", options.contextNote.trim());
  }
  return lines.join("\n");
}

function ingestContext(paths: string[]): string {
  return [
    "Command context:",
    "- Command: ingest",
    "- Paths:",
    ...paths.map((path) => `  - ${path}`),
  ].join("\n");
}

function isNotionIngest(options: IngestCommandOptions): boolean {
  return options.paths.length === 1 && options.paths[0] === "notion";
}

function notionSelectorFromOptions(options: IngestCommandOptions): NotionSelector {
  const selectorCount = [
    options.notionPage,
    options.notionQuery,
    options.notionDataSource,
  ].filter((value) => value !== undefined).length;
  if (selectorCount > 1) {
    throw new Error("Use only one Notion selector: --page, --query, or --data-source.");
  }
  if (options.notionPage !== undefined) {
    return { kind: "page", value: options.notionPage };
  }
  if (options.notionQuery !== undefined) {
    return { kind: "query", value: options.notionQuery };
  }
  if (options.notionDataSource !== undefined) {
    return { kind: "data-source", value: options.notionDataSource };
  }
  return { kind: "workspace", value: "notion" };
}

function hasNotionSelectorOption(options: IngestCommandOptions): boolean {
  return options.notionPage !== undefined ||
    options.notionQuery !== undefined ||
    options.notionDataSource !== undefined;
}

async function createNotionConnector(options: {
  composio?: ComposioClient;
} = {}): Promise<NotionConnector | NotionCliConnector> {
  const connection = await requireConnectorConnection("notion");
  if (connection.mode === "cli" || connection.connectedAccountId === "cli:notion") {
    return new NotionCliConnector();
  }
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new ConnectorNeedsActionError(
      "COMPOSIO_API_KEY is required to ingest Notion",
      "Set COMPOSIO_API_KEY and rerun: almanac ingest notion",
    );
  }
  const composio = options.composio ?? new ComposioClient({ apiKey });
  let status = connection.status;
  try {
    const account = await composio.getConnectedAccount(connection.connectedAccountId);
    status = account.status;
    await setConnectorConnection({
      ...connection,
      status,
      updatedAt: account.updatedAt ?? new Date().toISOString(),
    });
  } catch {
    if (status !== "ACTIVE") {
      throw new ConnectorNeedsActionError(
        "Notion authorization has not finished",
        "Finish the Notion authorization, then run: almanac connectors status",
      );
    }
  }
  if (status !== "ACTIVE") {
    throw new ConnectorNeedsActionError(
      `Notion connection is ${status}`,
      "Finish the Notion authorization, then run: almanac connectors status",
    );
  }
  return new NotionConnector({
    composio,
    connectedAccountId: connection.connectedAccountId,
  });
}

async function writeNotionSourceArtifact(
  repoRoot: string,
  bundle: import("../connectors/types.js").NormalizedSourceBundle,
): Promise<{ runId: string; path: string }> {
  const runId = createRunId();
  const path = join(runsDir(repoRoot), `${runId}.notion-source.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderNotionSourceArtifact(bundle), { encoding: "utf8", mode: 0o600 });
  return { runId, path };
}

function notionIngestContext(
  bundle: import("../connectors/types.js").NormalizedSourceBundle,
  options: { artifactPath?: string } = {},
): string {
  const lines = [
    "Command context:",
    "- Command: ingest",
    "- Connector: notion",
    `- Selector: ${bundle.selector.kind} (${bundle.selector.value})`,
    `- Fetched at: ${bundle.fetchedAt}`,
    `- Candidate limit: ${bundle.limits.candidateLimit}`,
    `- Full-fetch limit: ${bundle.limits.fullFetchLimit}`,
    "",
    "Notion source guidance:",
    "Treat Notion content as source evidence, not as output.",
    "Do not summarize the Notion source. Do not mirror the Notion hierarchy by default. Do not copy private notes wholesale.",
    "Extract only information that improves the Almanac wiki for future project work: decisions, product rationale, user research conclusions, workflows, constraints, gotchas, terminology, incidents, open questions, and cross-links between human context and code behavior.",
    "Prefer updating existing pages over creating new pages. When a claim touches implementation, verify it against the codebase. Keep Notion URLs, object IDs, and edit timestamps as provenance where useful. No-op if the source is personal, transient, duplicative, or not useful for future coding sessions.",
    "If Notion explains why a code path exists, update or create the page about that code path, decision, or product flow. If code contradicts Notion, trust code for current behavior and preserve Notion only as historical rationale when that history is useful.",
  ];
  if (bundle.candidates !== undefined && bundle.candidates.length > 0) {
    lines.push("", "Notion candidates:");
    for (const candidate of bundle.candidates) {
      lines.push(
        `- ${candidate.title} (${candidate.object}; ${candidate.id})` +
          `${candidate.url === undefined ? "" : ` ${candidate.url}`}` +
          `${candidate.lastEditedTime === undefined ? "" : ` last_edited=${candidate.lastEditedTime}`}`,
      );
    }
  }
  if (options.artifactPath !== undefined) {
    lines.push(
      "",
      "Fetched Notion documents:",
      `Read the Notion source artifact at ${options.artifactPath}. It is a local, gitignored, mode-0600 run artifact created for this ingest.`,
    );
    return lines.filter((line) => line !== "").join("\n");
  }
  lines.push("", "Fetched Notion documents:");
  lines.push(...renderNotionDocuments(bundle));
  return lines.filter((line) => line !== "").join("\n");
}

function renderNotionSourceArtifact(
  bundle: import("../connectors/types.js").NormalizedSourceBundle,
): string {
  return [
    "Fetched Notion documents:",
    ...renderNotionDocuments(bundle),
    "",
  ].join("\n");
}

function renderNotionDocuments(
  bundle: import("../connectors/types.js").NormalizedSourceBundle,
): string[] {
  const lines: string[] = [];
  for (const document of bundle.documents) {
    lines.push(
      "",
      `## ${document.title}`,
      `- Notion id: ${document.id}`,
      document.url === undefined ? "" : `- URL: ${document.url}`,
      document.createdTime === undefined ? "" : `- Created: ${document.createdTime}`,
      document.lastEditedTime === undefined ? "" : `- Last edited: ${document.lastEditedTime}`,
      document.parent === undefined ? "" : `- Parent: ${document.parent}`,
      "",
      document.text.length > 0 ? document.text : "[No supported Notion text blocks were returned.]",
    );
    if (document.omittedBlocks !== undefined && document.omittedBlocks.length > 0) {
      lines.push("", "Omitted Notion blocks:");
      for (const omitted of document.omittedBlocks) {
        lines.push(`- ${omitted.blockId} (${omitted.type}): ${omitted.reason}`);
      }
    }
  }
  return lines;
}

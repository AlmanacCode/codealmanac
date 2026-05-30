import { resolve } from "node:path";

import type { CommandResult } from "../cli/helpers.js";
import { renderOutcome } from "../cli/outcome.js";
import type { HarnessEvent } from "../harness/events.js";
import type { HarnessProviderId } from "../harness/types.js";
import { runAbsorbOperation } from "../operations/absorb.js";
import { runBuildOperation } from "../operations/build.js";
import { runGardenOperation } from "../operations/garden.js";
import { readConfig } from "../config/index.js";
import {
  GitHubSourceError,
  resolveGitHubSource,
  type Source,
} from "../ingest/github.js";
import { parseSourceRef, type SourceRef } from "../ingest/source-ref.js";
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
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
  resolveSource?: (ref: SourceRef, cwd: string) => Promise<Source>;
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
    const input = await resolveIngestInput(options);
    if (!input.ok) {
      return renderOutcome(
        { type: "error", message: input.message },
        { json: options.json },
      );
    }
    const result = await runAbsorbOperation({
      cwd: options.cwd,
      provider: provider.value,
      background: options.foreground !== true,
      context: ingestContext(input.value),
      targetKind: input.value.kind,
      targetPaths: input.value.targets,
      onEvent: options.onEvent,
      startForeground: options.startForeground,
      startBackground: options.startBackground,
    });
    return renderOperationResult("ingest", result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
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
  if (err instanceof GitHubSourceError) {
    return renderOutcome(
      {
        type: "needs-action",
        message: err.message,
        fix: err.fix,
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

type ResolvedIngestInput =
  | { kind: "path"; targets: string[]; paths: string[] }
  | { kind: "source"; targets: string[]; sources: Source[] };

async function resolveIngestInput(
  options: IngestCommandOptions,
): Promise<
  | { ok: true; value: ResolvedIngestInput }
  | { ok: false; message: string }
> {
  const sourceRefs: SourceRef[] = [];
  const paths: string[] = [];
  for (const input of options.paths) {
    const parsed = parseSourceRef(input);
    if (parsed.ok) {
      sourceRefs.push(parsed.value);
      continue;
    }
    if (parsed.reason === "not-source-ref") {
      paths.push(input);
      continue;
    }
    return { ok: false, message: parsed.message };
  }

  if (sourceRefs.length > 0 && paths.length > 0) {
    return {
      ok: false,
      message:
        "ingest cannot mix source refs and local paths yet; run separate ingest commands",
    };
  }

  if (sourceRefs.length > 0) {
    const resolveSource = options.resolveSource ?? defaultResolveSource;
    const sources: Source[] = [];
    for (const sourceRef of sourceRefs) {
      sources.push(await resolveSource(sourceRef, options.cwd));
    }
    return {
      ok: true,
      value: {
        kind: "source",
        targets: sources.map((source) => source.raw),
        sources,
      },
    };
  }

  const resolvedPaths = paths.map((path) => resolve(options.cwd, path));
  return {
    ok: true,
    value: {
      kind: "path",
      targets: resolvedPaths,
      paths: resolvedPaths,
    },
  };
}

function defaultResolveSource(ref: SourceRef, cwd: string): Promise<Source> {
  if (ref.provider === "github") return resolveGitHubSource({ ref, cwd });
  throw new Error(`unsupported source provider '${ref.provider}'`);
}

function ingestContext(input: ResolvedIngestInput): string {
  if (input.kind === "source") return sourceIngestContext(input.sources);
  return [
    "Command context:",
    "- Command: ingest",
    "- Paths:",
    ...input.paths.map((path) => `  - ${path}`),
  ].join("\n");
}

function sourceIngestContext(sources: Source[]): string {
  const lines = [
    "Command context:",
    "- Command: ingest",
    "- Sources:",
  ];
  for (const source of sources) {
    if (source.kind === "github.pr") {
      lines.push(
        `  - Input source: ${source.raw}`,
        "    Source kind: GitHub pull request",
        `    Repository: ${source.repo}`,
        `    URL: ${source.url}`,
        "",
        "GitHub PR ingest guidance:",
        "Use the GitHub CLI (`gh`) to inspect this PR as needed.",
        "",
        "Suggested commands:",
        `- gh pr view ${source.number} --repo ${source.repo} --json title,body,url,author,baseRefName,headRefName,mergedAt,files,reviews,comments,closingIssuesReferences`,
        `- gh pr diff ${source.number} --repo ${source.repo}`,
        "",
        "Treat PR discussion as evidence, not final truth.",
        "Prefer current code and the merged diff for present-tense behavior.",
        "Update the Almanac only if this PR contains durable project memory.",
        "If this PR supports a wiki claim, cite it with a `sources:` entry of `type: pr`.",
        "No-op if the PR does not improve durable project memory.",
      );
    }
  }
  return lines.join("\n");
}

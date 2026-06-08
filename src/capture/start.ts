import type { HarnessEvent } from "../harness/events.js";
import { runAbsorbOperation } from "../operations/absorb.js";
import { MissingWikiError } from "../operations/errors.js";
import type {
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundProcess,
  StartForegroundProcess,
} from "../operations/types.js";
import { findNearestAlmanacDir } from "../paths.js";
import { resolveCaptureTranscripts } from "./input.js";

export class CaptureInputError extends Error {
  constructor(
    message: string,
    public readonly fix: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CaptureInputError";
  }
}

export interface StartCaptureRunOptions {
  cwd: string;
  provider: OperationProviderSelection;
  sessionFiles?: string[];
  app?: string;
  session?: string;
  since?: string;
  limit?: number;
  all?: boolean;
  allApps?: boolean;
  foreground?: boolean;
  claudeProjectsDir?: string;
  contextNote?: string;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
}

export interface CaptureRunStart {
  runId: string;
  result: OperationRunResult;
  targetPaths: string[];
}

export async function startCaptureRun(
  options: StartCaptureRunOptions,
): Promise<CaptureRunStart> {
  const repoRoot = findNearestAlmanacDir(options.cwd);
  if (repoRoot === null) throw new MissingWikiError();

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
    throw new CaptureInputError(resolved.error, resolved.fix, {
      app: options.app,
      session: options.session,
      since: options.since,
      limit: options.limit,
      all: options.all,
      allApps: options.allApps,
    });
  }

  const paths = resolved.paths;
  const result = await runAbsorbOperation({
    cwd: options.cwd,
    provider: options.provider,
    background: options.foreground !== true,
    context: captureContext({ ...options, sessionFiles: paths }),
    targetKind: "session",
    targetPaths: paths,
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
  });
  return {
    runId: result.runId,
    result,
    targetPaths: paths,
  };
}

function captureContext(options: StartCaptureRunOptions): string {
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

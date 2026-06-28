import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { parseGitHubRemote, type CommandRunner } from "../../absorb/github.js";
import type {
  BranchSource,
  ConversationMessageUpload,
  ConversationRole,
  ConversationTurnUpload,
} from "../types.js";
import { parseJsonObject, textFromUnknown } from "./json.js";
import type { NormalizedHookPayload } from "./providers/types.js";
import type { TurnOpenState } from "./turn-state.js";

const execFileAsync = promisify(execFile);

export interface GitRouting {
  branch: string | null;
  branchSource: BranchSource;
  headSha: string | null;
  repoFullName: string | null;
}

export interface BuildConversationTurnOptions {
  start: TurnOpenState;
  stop: NormalizedHookPayload;
  completedAt?: Date;
  runCommand?: CommandRunner;
}

export async function buildConversationTurnUpload(
  options: BuildConversationTurnOptions,
): Promise<{ upload: ConversationTurnUpload; repoFullName: string | null }> {
  const cwd = options.stop.cwd || options.start.cwd;
  const routing = await resolveGitRouting({
    cwd,
    branch: options.stop.branch ?? options.start.branch,
    runCommand: options.runCommand,
  });
  const messages = mergeMessages(
    options.start.messages,
    await readTranscriptMessages(
      options.start.transcriptPath ?? options.stop.transcriptPath,
      options.start.transcriptOffset,
    ),
  );
  return {
    repoFullName: routing.repoFullName,
    upload: {
      provider: options.start.provider,
      providerSessionId: options.start.sessionId,
      transcriptPathHash: hashPath(options.start.transcriptPath ?? options.stop.transcriptPath),
      firstCwd: options.start.cwd,
      providerTurnId: options.start.turnId,
      branch: routing.branch,
      branchSource: routing.branchSource,
      routingStatus: routing.branch === null ? "missing_branch" : "routable",
      headSha: routing.headSha,
      startedAt: options.start.startedAt,
      completedAt: (options.completedAt ?? new Date()).toISOString(),
      messages,
    },
  };
}

export async function resolveGitRouting(options: {
  cwd: string;
  branch: string | null;
  runCommand?: CommandRunner;
}): Promise<GitRouting> {
  const runCommand = options.runCommand ?? defaultCommandRunner;
  const branch = options.branch ?? await gitOutput(runCommand, options.cwd, [
    "branch",
    "--show-current",
  ]);
  const repo = await gitOutput(runCommand, options.cwd, ["remote", "get-url", "origin"]);
  const parsedRepo = repo === null ? null : parseGitHubRemote(repo);
  const headSha = await gitOutput(runCommand, options.cwd, ["rev-parse", "HEAD"]);
  return {
    branch,
    branchSource: options.branch === null
      ? branch === null ? "missing" : "git_fallback"
      : "transcript",
    headSha,
    repoFullName: parsedRepo === null ? null : `${parsedRepo.owner}/${parsedRepo.repo}`,
  };
}

export async function readTranscriptMessages(
  transcriptPath: string | null,
  offset: number,
): Promise<ConversationMessageUpload[]> {
  if (transcriptPath === null) return [];
  let raw: string;
  try {
    const buffer = await readFile(transcriptPath);
    raw = buffer.subarray(Math.max(0, offset)).toString("utf8");
  } catch {
    return [];
  }
  const messages: ConversationMessageUpload[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseJsonObject(line);
    if (parsed === null) continue;
    const message = messageFromTranscriptObject(parsed);
    if (message !== null) messages.push(message);
  }
  return messages;
}

function messageFromTranscriptObject(
  object: Record<string, unknown>,
): ConversationMessageUpload | null {
  const role = roleFromUnknown(object.role) ??
    roleFromUnknown(object.type) ??
    roleFromUnknown(nested(object, ["message", "role"]));
  if (role === null) return null;
  const content = textFromUnknown(object.content) ??
    textFromUnknown(object.message) ??
    textFromUnknown(object.payload);
  if (content === null) return null;
  const occurred = typeof object.timestamp === "string"
    ? object.timestamp
    : typeof object.created_at === "string"
      ? object.created_at
      : null;
  return {
    role,
    content,
    occurredAt: occurred,
  };
}

function roleFromUnknown(value: unknown): ConversationRole | null {
  if (value === "user" || value === "assistant" || value === "system" || value === "tool") {
    return value;
  }
  if (value === "human") return "user";
  return null;
}

function nested(object: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = object;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function mergeMessages(
  first: ConversationMessageUpload[],
  second: ConversationMessageUpload[],
): ConversationMessageUpload[] {
  const seen = new Set<string>();
  const out: ConversationMessageUpload[] = [];
  for (const message of [...first, ...second]) {
    const key = `${message.role}\0${message.content}\0${message.occurredAt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(message);
  }
  return out;
}

function hashPath(path: string | null): string {
  return createHash("sha256").update(path ?? "missing").digest("hex");
}

async function gitOutput(
  runCommand: CommandRunner,
  cwd: string,
  args: string[],
): Promise<string | null> {
  try {
    const result = await runCommand("git", args, { cwd });
    const trimmed = result.stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

async function defaultCommandRunner(
  command: string,
  args: string[],
  options: { cwd: string },
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

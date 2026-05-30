import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { SourceRef } from "./source-ref.js";

const execFileAsync = promisify(execFile);

export interface Source {
  kind: "github.pr";
  raw: string;
  repo: string;
  url: string;
  number: string;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

export class GitHubSourceError extends Error {
  constructor(message: string, readonly fix: string) {
    super(message);
  }
}

export async function resolveGitHubSource(args: {
  ref: Extract<SourceRef, { provider: "github" }>;
  cwd: string;
  runCommand?: CommandRunner;
}): Promise<Source> {
  const runCommand = args.runCommand ?? defaultCommandRunner;
  let remote: { stdout: string };
  try {
    remote = await runCommand("git", ["remote", "get-url", "origin"], {
      cwd: args.cwd,
    });
  } catch {
    throw githubRemoteError();
  }
  const repo = parseGitHubRemote(remote.stdout.trim());
  if (repo === null) throw githubRemoteError();

  try {
    await runCommand("gh", ["--version"], { cwd: args.cwd });
  } catch {
    throw ghMissingError(args.ref.raw);
  }

  try {
    await runCommand("gh", ["auth", "status"], { cwd: args.cwd });
  } catch {
    throw ghAuthError(args.ref.raw);
  }

  const repoName = `${repo.owner}/${repo.repo}`;
  return {
    kind: "github.pr",
    raw: args.ref.raw,
    repo: repoName,
    url: `https://github.com/${repoName}/pull/${args.ref.id}`,
    number: args.ref.id,
  };
}

export function parseGitHubRemote(remote: string): GitHubRepo | null {
  const normalized = remote.trim();
  const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch !== null) return repoFromMatch(sshMatch[1], sshMatch[2]);

  try {
    const url = new URL(normalized);
    if (url.hostname !== "github.com") return null;
    const bits = url.pathname.replace(/^\/+/, "").split("/");
    if (bits.length < 2) return null;
    return repoFromMatch(bits[0], bits[1]);
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

function repoFromMatch(owner: string | undefined, rawRepo: string | undefined): GitHubRepo | null {
  if (owner === undefined || rawRepo === undefined) return null;
  const repo = rawRepo.replace(/\.git$/, "");
  if (!isSafeGitHubPart(owner) || !isSafeGitHubPart(repo)) return null;
  return { owner, repo };
}

function isSafeGitHubPart(part: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(part);
}

function ghMissingError(ref: string): GitHubSourceError {
  return new GitHubSourceError(
    "GitHub ingest needs the GitHub CLI (`gh`).",
    [
      "Install and authenticate it:",
      "",
      "  1. Install GitHub CLI:",
      "     https://cli.github.com/",
      "",
      "  2. Sign in:",
      "     gh auth login",
      "",
      "  3. Try again:",
      `     almanac ingest ${ref}`,
    ].join("\n"),
  );
}

function ghAuthError(ref: string): GitHubSourceError {
  return new GitHubSourceError(
    "GitHub CLI is installed, but not authenticated.",
    [
      "Sign in with:",
      "",
      "  gh auth login",
      "",
      "Then try again:",
      `  almanac ingest ${ref}`,
    ].join("\n"),
  );
}

function githubRemoteError(): GitHubSourceError {
  return new GitHubSourceError(
    "GitHub source ingest requires a GitHub remote for this repository.",
    [
      "Set an origin remote that points to GitHub, or run this command from a GitHub-backed repo:",
      "",
      "  git remote -v",
    ].join("\n"),
  );
}

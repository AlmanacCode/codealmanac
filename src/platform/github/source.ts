import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { UserFacingError } from "../../errors.js";
import type {
  GitHubAbsorbInputSource,
  GitHubRepoRef,
  GitHubSourceRef,
} from "../../shared/absorb-sources.js";

const execFileAsync = promisify(execFile);

export type GitHubRepo = GitHubRepoRef;
export type ResolvedGitHubSource = GitHubAbsorbInputSource;

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

export class GitHubSourceError extends UserFacingError {
  constructor(message: string, fix: string) {
    super(message, { outcome: "needs-action", fix });
  }
}

export async function resolveGitHubSource(args: {
  ref: GitHubSourceRef;
  cwd: string;
  runCommand?: CommandRunner;
}): Promise<ResolvedGitHubSource> {
  const runCommand = args.runCommand ?? defaultCommandRunner;
  const repo = args.ref.repo ?? await resolveRepoFromRemote(runCommand, args.cwd);
  if (repo === null) throw githubRemoteError();

  const repoName = `${repo.owner}/${repo.repo}`;
  const sourceKind = args.ref.kind === "pr" ? "pull" : "issues";
  return {
    kind: args.ref.kind === "pr" ? "github.pr" : "github.issue",
    raw: args.ref.raw,
    repo: repoName,
    url: `https://github.com/${repoName}/${sourceKind}/${args.ref.id}`,
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

async function resolveRepoFromRemote(
  runCommand: CommandRunner,
  cwd: string,
): Promise<GitHubRepo | null> {
  try {
    const remote = await runCommand("git", ["remote", "get-url", "origin"], {
      cwd,
    });
    return parseGitHubRemote(remote.stdout.trim());
  } catch {
    return null;
  }
}

function isSafeGitHubPart(part: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(part);
}

function githubRemoteError(): GitHubSourceError {
  return new GitHubSourceError(
    "GitHub source absorb requires a GitHub remote for this repository.",
    [
      "Set an origin remote that points to GitHub, or run this command from a GitHub-backed repo:",
      "",
      "  git remote -v",
    ].join("\n"),
  );
}

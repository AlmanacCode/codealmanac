import type { CommandResult } from "../helpers.js";
import { renderError } from "../outcome.js";
import { login, logout, authenticatedClient, readCredentials } from "../../cloud/auth.js";
import { captureHook } from "../../cloud/capture/hooks.js";
import type { CloudHookEvent, CloudProvider } from "../../cloud/types.js";
import { readCloudHooksStatus } from "../../platform/cloud-hooks/status.js";

export async function runCloudLogin(): Promise<CommandResult> {
  const lines: string[] = [];
  try {
    const credentials = await login({
      onPending: (info) => {
        lines.push("Open this URL to finish Almanac Cloud login:");
        lines.push(info.verificationUrl);
        lines.push(`Code: ${info.userCode}`);
      },
    });
    return {
      stdout: [
        ...lines,
        `Logged in to Almanac Cloud as ${credentials.githubLogin ?? "your account"}.`,
      ].join("\n") + "\n",
      stderr: "",
      exitCode: 0,
    };
  } catch (err: unknown) {
    return renderError(err, { stdout: lines.length > 0 ? `${lines.join("\n")}\n` : "" });
  }
}

export async function runCloudLogout(): Promise<CommandResult> {
  try {
    const me = await logout();
    return {
      stdout: me === null
        ? "Already logged out of Almanac Cloud.\n"
        : `Logged out of Almanac Cloud as ${me.githubLogin}.\n`,
      stderr: "",
      exitCode: 0,
    };
  } catch (err: unknown) {
    return renderError(err);
  }
}

export async function runCloudStatus(options: {
  cwd?: string;
  json?: boolean;
} = {}): Promise<CommandResult> {
  const cwd = options.cwd ?? process.cwd();
  const hooks = await readCloudHooksStatus();
  const credentials = await readCredentials();
  if (credentials === null) {
    const status = {
      loggedIn: false,
      baseUrl: null,
      hooks,
      repo: await currentRepoStatus(cwd),
    };
    return formatStatus(status, options.json);
  }

  try {
    const { client } = await authenticatedClient();
    const me = await client.me();
    const status = {
      loggedIn: true,
      baseUrl: credentials.baseUrl,
      githubLogin: me.githubLogin,
      hooks,
      repo: await currentRepoStatus(cwd),
    };
    return formatStatus(status, options.json);
  } catch (err: unknown) {
    return renderError(err);
  }
}

export async function runCloudCaptureHook(options: {
  provider: CloudProvider;
  event: CloudHookEvent;
  stdin: string;
  cwd?: string;
  json?: boolean;
}): Promise<CommandResult> {
  try {
    const result = await captureHook({
      provider: options.provider,
      event: options.event,
      stdin: options.stdin,
      cwd: options.cwd ?? process.cwd(),
    });
    if (options.json === true) {
      return {
        stdout: `${JSON.stringify(result, null, 2)}\n`,
        stderr: "",
        exitCode: 0,
      };
    }
    return {
      stdout: `${result.message}\n`,
      stderr: "",
      exitCode: 0,
    };
  } catch (err: unknown) {
    return renderError(err, { json: options.json });
  }
}

function formatStatus(
  status: {
    loggedIn: boolean;
    baseUrl: string | null;
    githubLogin?: string;
    hooks: Awaited<ReturnType<typeof readCloudHooksStatus>>;
    repo: { branch: string | null; headSha: string | null; repoFullName: string | null };
  },
  json?: boolean,
): CommandResult {
  if (json === true) {
    return {
      stdout: `${JSON.stringify(status, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  const lines = [
    status.loggedIn
      ? `Cloud: logged in as ${status.githubLogin ?? "your account"}`
      : "Cloud: logged out",
    status.baseUrl === null ? null : `Endpoint: ${status.baseUrl}`,
    `Codex hooks: ${status.hooks.codex.installed ? "installed" : "missing"}`,
    `Claude hooks: ${status.hooks.claude.installed ? "installed" : "missing"}`,
    status.repo.repoFullName === null ? "Repository: not detected" : `Repository: ${status.repo.repoFullName}`,
    status.repo.branch === null ? "Branch: missing" : `Branch: ${status.repo.branch}`,
    status.repo.headSha === null ? null : `HEAD: ${status.repo.headSha}`,
  ].filter((line): line is string => line !== null);
  return {
    stdout: `${lines.join("\n")}\n`,
    stderr: "",
    exitCode: 0,
  };
}

async function currentRepoStatus(cwd: string): Promise<{
  branch: string | null;
  headSha: string | null;
  repoFullName: string | null;
}> {
  const { resolveGitRouting } = await import("../../cloud/capture/conversation-turn.js");
  const routing = await resolveGitRouting({ cwd, branch: null });
  return {
    branch: routing.branch,
    headSha: routing.headSha,
    repoFullName: routing.repoFullName,
  };
}

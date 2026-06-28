import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { dirname } from "node:path";
import { promisify } from "node:util";

import { UserFacingError } from "../errors.js";
import { cloudBaseUrl, credentialsPath } from "./config.js";
import { CloudClient } from "./client.js";
import type { CliMe, CloudCredentials } from "./types.js";

const execFileAsync = promisify(execFile);

export interface LoginOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  openUrl?: (url: string) => Promise<void> | void;
  pollIntervalMs?: number;
  timeoutMs?: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  onPending?: (info: { verificationUrl: string; userCode: string }) => void;
}

export async function login(options: LoginOptions = {}): Promise<CloudCredentials> {
  const baseUrl = options.baseUrl ?? cloudBaseUrl();
  const client = new CloudClient({ baseUrl, fetchImpl: options.fetchImpl });
  const session = await client.createLoginSession();
  options.onPending?.({
    verificationUrl: session.verificationUrl,
    userCode: session.userCode,
  });
  await (options.openUrl ?? openUrl)(session.verificationUrl);

  const deadline = Date.now() + (options.timeoutMs ?? 10 * 60 * 1000);
  const sleep = options.sleep ?? defaultSleep;
  const interval = options.pollIntervalMs ?? 2_000;
  let current = session;

  while (Date.now() <= deadline) {
    if (current.status === "expired") {
      throw new UserFacingError("Almanac Cloud login expired. Run `almanac login` again.");
    }
    if (current.token !== null) {
      const authedClient = new CloudClient({
        baseUrl,
        token: current.token,
        fetchImpl: options.fetchImpl,
      });
      const me = await authedClient.me();
      const credentials: CloudCredentials = {
        token: current.token,
        baseUrl,
        githubLogin: me.githubLogin,
        savedAt: (options.now ?? (() => new Date()))().toISOString(),
      };
      await writeCredentials(credentials);
      return credentials;
    }
    await sleep(interval);
    current = await client.pollLoginSession(session.sessionId);
  }

  throw new UserFacingError("Timed out waiting for Almanac Cloud login.");
}

export async function logout(options: {
  fetchImpl?: typeof fetch;
} = {}): Promise<CliMe | null> {
  const credentials = await readCredentials();
  if (credentials === null) return null;
  const client = new CloudClient({
    baseUrl: credentials.baseUrl,
    token: credentials.token,
    fetchImpl: options.fetchImpl,
  });
  let me: CliMe | null = null;
  try {
    me = await client.logout();
  } finally {
    await deleteCredentials();
  }
  return me;
}

export async function authenticatedClient(options: {
  fetchImpl?: typeof fetch;
} = {}): Promise<{ client: CloudClient; credentials: CloudCredentials }> {
  const credentials = await readCredentials();
  if (credentials === null) {
    throw new UserFacingError("Not logged in to Almanac Cloud.", {
      outcome: "needs-action",
      fix: "Run `almanac login`.",
    });
  }
  return {
    credentials,
    client: new CloudClient({
      baseUrl: credentials.baseUrl,
      token: credentials.token,
      fetchImpl: options.fetchImpl,
    }),
  };
}

export async function readCredentials(): Promise<CloudCredentials | null> {
  try {
    const raw = await readFile(credentialsPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isCloudCredentials(parsed)) return null;
    return parsed;
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function writeCredentials(credentials: CloudCredentials): Promise<void> {
  const path = credentialsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function deleteCredentials(): Promise<void> {
  await rm(credentialsPath(), { force: true });
}

function isCloudCredentials(value: unknown): value is CloudCredentials {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.token === "string" &&
    record.token.length > 0 &&
    typeof record.baseUrl === "string" &&
    record.baseUrl.length > 0 &&
    typeof record.savedAt === "string" &&
    (record.githubLogin === undefined || typeof record.githubLogin === "string")
  );
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "ENOENT"
  );
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openUrl(url: string): Promise<void> {
  try {
    const os = platform();
    if (os === "darwin") {
      await execFileAsync("open", [url]);
    } else if (os === "win32") {
      await execFileAsync("cmd", ["/c", "start", "", url]);
    } else {
      await execFileAsync("xdg-open", [url]);
    }
  } catch {
    // The URL is printed before this runs, so login still works in headless shells.
  }
}

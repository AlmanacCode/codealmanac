import { spawn } from "node:child_process";

import type { CommandResult } from "../cli/helpers.js";
import { renderOutcome } from "../cli/outcome.js";
import {
  ComposioClient,
  ComposioError,
  type ComposioConnectedAccount,
} from "../connectors/composio.js";
import { ComposioCli } from "../connectors/composio-cli.js";
import {
  getConnectorConnection,
  readConnectorStore,
  removeConnectorConnection,
  setConnectorConnection,
} from "../connectors/store.js";
import type { ConnectorConnection, ConnectorId } from "../connectors/types.js";

const DEFAULT_CONNECT_USER_ID = "almanac-local-user";

export interface ConnectorCommandDeps {
  composio?: ComposioClient;
  composioCli?: ComposioCli;
  openUrl?: (url: string) => Promise<boolean | void>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface ConnectNotionOptions extends ConnectorCommandDeps {
  json?: boolean;
  apiKey?: string;
  authConfigId?: string;
  userId?: string;
  fromComposioCli?: boolean;
  noOpen?: boolean;
  wait?: boolean;
  timeoutMs?: number;
}

export interface ConnectorStatusOptions extends ConnectorCommandDeps {
  json?: boolean;
}

export interface DisconnectNotionOptions extends ConnectorCommandDeps {
  json?: boolean;
  revoke?: boolean;
}

export async function runConnectNotionCommand(
  options: ConnectNotionOptions = {},
): Promise<CommandResult> {
  if (options.fromComposioCli === true) {
    return connectNotionWithCli(options);
  }
  const apiKey = options.apiKey ?? process.env.COMPOSIO_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    return renderOutcome(
      {
        type: "needs-action",
        message: "Composio API credentials are required to connect Notion",
        fix: [
          "Set COMPOSIO_API_KEY and COMPOSIO_NOTION_AUTH_CONFIG_ID, then rerun:",
          "  almanac connect notion",
          "",
          "For local development with an already-linked Composio CLI, run:",
          "  almanac connect notion --from-composio-cli",
        ].join("\n"),
      },
      { json: options.json },
    );
  }
  const authConfigId = options.authConfigId ?? process.env.COMPOSIO_NOTION_AUTH_CONFIG_ID;
  if (authConfigId === undefined || authConfigId.trim().length === 0) {
    return renderOutcome(
      {
        type: "needs-action",
        message: "COMPOSIO_NOTION_AUTH_CONFIG_ID is required to connect Notion",
        fix: "Create a Composio Notion auth config, set COMPOSIO_NOTION_AUTH_CONFIG_ID, and rerun: almanac connect notion",
      },
      { json: options.json },
    );
  }

  const client = options.composio ?? new ComposioClient({ apiKey });
  const userId = options.userId ?? process.env.COMPOSIO_USER_ID ?? DEFAULT_CONNECT_USER_ID;
  try {
    const link = await client.createLinkSession({
      authConfigId,
      userId,
    });
    const opened = options.noOpen === true
      ? false
      : await (options.openUrl ?? openUrl)(link.redirectUrl);
    const shouldWait = options.wait !== false && opened !== false;
    const account = !shouldWait
      ? null
      : await waitForConnectedAccount({
        client,
        connectedAccountId: link.connectedAccountId,
        timeoutMs: options.timeoutMs ?? 120_000,
        sleep: options.sleep ?? sleep,
      });
    const now = (options.now ?? (() => new Date()))().toISOString();
    await setConnectorConnection({
      id: "notion",
      provider: "composio",
      connectedAccountId: link.connectedAccountId,
      userId,
      authConfigId,
      status: account?.status ?? "PENDING",
      createdAt: account?.createdAt ?? now,
      updatedAt: account?.updatedAt ?? now,
    });
    const statusLine = account === null
      ? "Notion authorization started"
      : "Notion connected";
    const stdout = [
      `almanac: ${statusLine}.`,
      `Authorize: ${link.redirectUrl}`,
      `Connected account: ${link.connectedAccountId}`,
      account === null ? "Run `almanac connectors status` after authorizing." : "Try: almanac ingest notion",
      "",
    ].join("\n");
    return renderOutcome(
      {
        type: "success",
        message: statusLine,
        data: {
          connector: "notion",
          provider: "composio",
          connectedAccountId: link.connectedAccountId,
          redirectUrl: link.redirectUrl,
          status: account?.status ?? "PENDING",
        },
      },
      { json: options.json, stdout },
    );
  } catch (err: unknown) {
    return renderConnectorError(err, options.json);
  }
}

async function connectNotionWithCli(
  options: ConnectNotionOptions,
): Promise<CommandResult> {
  const cli = options.composioCli ?? new ComposioCli();
  try {
    const whoami = await cli.whoami();
    const search = await cli.searchNotion();
    const connected = Array.isArray(search.connected_toolkits) &&
      search.connected_toolkits.includes("notion");
    if (!connected) {
      return renderOutcome(
        {
          type: "needs-action",
          message: "Notion is not linked in Composio CLI",
          fix: "run: ~/.composio/composio link notion",
        },
        { json: options.json },
      );
    }
    const now = (options.now ?? (() => new Date()))().toISOString();
    await setConnectorConnection({
      id: "notion",
      provider: "composio",
      connectedAccountId: "cli:notion",
      mode: "cli",
      userId: readString(whoami, "test_user_id") ?? readString(whoami, "email") ?? DEFAULT_CONNECT_USER_ID,
      authConfigId: "composio-cli",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
    return renderOutcome(
      {
        type: "success",
        message: "Notion connected through Composio CLI",
        data: {
          connector: "notion",
          provider: "composio",
          mode: "cli",
          status: "ACTIVE",
        },
      },
      { json: options.json },
    );
  } catch (err: unknown) {
    return renderConnectorError(err, options.json);
  }
}

export async function runConnectorsStatusCommand(
  options: ConnectorStatusOptions = {},
): Promise<CommandResult> {
  const store = await readConnectorStore();
  const connection = store.connectors.notion;
  if (connection === undefined) {
    return renderOutcome(
      {
        type: "noop",
        message: "No connectors configured",
        data: { connectors: [] },
      },
      { json: options.json },
    );
  }
  const refreshed = await refreshConnectionStatus(connection, options);
  const stdout = [
    "CONNECTOR  PROVIDER  STATUS  ACCOUNT",
    `notion     composio  ${refreshed.status}  ${refreshed.connectedAccountId}`,
    "",
  ].join("\n");
  return renderOutcome(
    {
      type: "success",
      message: "Connectors configured",
      data: { connectors: [refreshed] },
    },
    { json: options.json, stdout },
  );
}

export async function runDisconnectNotionCommand(
  options: DisconnectNotionOptions = {},
): Promise<CommandResult> {
  const connection = await getConnectorConnection("notion");
  if (connection === null) {
    return renderOutcome(
      {
        type: "noop",
        message: "Notion is not connected",
      },
      { json: options.json },
    );
  }
  const canRevokeUpstream = options.revoke === true && connection.mode !== "cli";
  if (canRevokeUpstream) {
    try {
      await (options.composio ?? composioFromEnv()).deleteConnectedAccount(
        connection.connectedAccountId,
      );
    } catch (err: unknown) {
      return renderConnectorError(err, options.json);
    }
  }
  await removeConnectorConnection("notion");
  return renderOutcome(
    {
      type: "success",
      message: "Notion disconnected",
      data: {
        connector: "notion",
        revoked: canRevokeUpstream,
      },
    },
    { json: options.json },
  );
}

export async function requireConnectorConnection(
  id: ConnectorId,
): Promise<ConnectorConnection> {
  const connection = await getConnectorConnection(id);
  if (connection === null) {
    throw new ConnectorNeedsActionError(
      `${displayConnector(id)} is not connected`,
      `run: almanac connect ${id}`,
    );
  }
  return connection;
}

export class ConnectorNeedsActionError extends Error {
  constructor(message: string, readonly fix: string) {
    super(message);
  }
}

function composioFromEnv(): ComposioClient {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new ConnectorNeedsActionError(
      "COMPOSIO_API_KEY is required",
      "Set COMPOSIO_API_KEY and rerun the command.",
    );
  }
  return new ComposioClient({ apiKey });
}

async function waitForConnectedAccount(args: {
  client: ComposioClient;
  connectedAccountId: string;
  timeoutMs: number;
  sleep: (ms: number) => Promise<void>;
}): Promise<ComposioConnectedAccount | null> {
  const started = Date.now();
  while (Date.now() - started < args.timeoutMs) {
    const account = await args.client.getConnectedAccount(args.connectedAccountId);
    if (account.status === "ACTIVE") return account;
    if (["FAILED", "EXPIRED", "DELETED"].includes(account.status)) {
      throw new Error(`Notion connection ended with status ${account.status}`);
    }
    await args.sleep(2_000);
  }
  return null;
}

async function refreshConnectionStatus(
  connection: ConnectorConnection,
  options: ConnectorStatusOptions,
): Promise<ConnectorConnection> {
  if (connection.mode === "cli") return connection;
  if (options.composio === undefined && process.env.COMPOSIO_API_KEY === undefined) {
    return connection;
  }
  try {
    const account = await (options.composio ?? composioFromEnv())
      .getConnectedAccount(connection.connectedAccountId);
    const refreshed = {
      ...connection,
      status: account.status,
      updatedAt: account.updatedAt ?? new Date().toISOString(),
    };
    await setConnectorConnection(refreshed);
    return refreshed;
  } catch {
    return connection;
  }
}

function renderConnectorError(
  err: unknown,
  json: boolean | undefined,
): CommandResult {
  if (err instanceof ConnectorNeedsActionError) {
    return renderOutcome(
      { type: "needs-action", message: err.message, fix: err.fix },
      { json },
    );
  }
  if (err instanceof ComposioError && err.suggestedFix !== undefined) {
    return renderOutcome(
      {
        type: "needs-action",
        message: err.message,
        fix: err.suggestedFix,
      },
      { json },
    );
  }
  return renderOutcome(
    {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    },
    { json },
  );
}

function displayConnector(id: ConnectorId): string {
  return id === "notion" ? "Notion" : id;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function openUrl(url: string): Promise<boolean> {
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  return await new Promise<boolean>((resolve) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.on("error", () => resolve(false));
    child.on("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

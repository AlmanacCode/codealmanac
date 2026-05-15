import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getGlobalAlmanacDir } from "../paths.js";
import type {
  ConnectorConnection,
  ConnectorId,
  ConnectorStore,
} from "./types.js";

const STORE_VERSION = 1;

export function getConnectorStorePath(): string {
  return join(getGlobalAlmanacDir(), "connectors.json");
}

export async function readConnectorStore(
  file = getConnectorStorePath(),
): Promise<ConnectorStore> {
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
    return normalizeConnectorStore(raw);
  } catch {
    return emptyStore();
  }
}

export async function writeConnectorStore(
  store: ConnectorStore,
  file = getConnectorStorePath(),
): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

export async function getConnectorConnection(
  id: ConnectorId,
): Promise<ConnectorConnection | null> {
  return (await readConnectorStore()).connectors[id] ?? null;
}

export async function setConnectorConnection(
  connection: ConnectorConnection,
): Promise<void> {
  const store = await readConnectorStore();
  store.connectors[connection.id] = connection;
  await writeConnectorStore(store);
}

export async function removeConnectorConnection(id: ConnectorId): Promise<boolean> {
  const store = await readConnectorStore();
  const existed = store.connectors[id] !== undefined;
  delete store.connectors[id];
  await writeConnectorStore(store);
  return existed;
}

function normalizeConnectorStore(raw: unknown): ConnectorStore {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyStore();
  }
  const record = raw as Record<string, unknown>;
  const rawConnectors = record.connectors;
  const connectors: ConnectorStore["connectors"] = {};
  if (
    rawConnectors !== null &&
    typeof rawConnectors === "object" &&
    !Array.isArray(rawConnectors)
  ) {
    const notion = normalizeConnection(
      (rawConnectors as Record<string, unknown>).notion,
    );
    if (notion !== null) connectors.notion = notion;
  }
  return {
    version: STORE_VERSION,
    connectors,
  };
}

function normalizeConnection(raw: unknown): ConnectorConnection | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (
    record.id !== "notion" ||
    record.provider !== "composio" ||
    typeof record.connectedAccountId !== "string" ||
    typeof record.userId !== "string" ||
    typeof record.authConfigId !== "string"
  ) {
    return null;
  }
  return {
    id: "notion",
    provider: "composio",
    connectedAccountId: record.connectedAccountId,
    mode: record.mode === "cli" ? "cli" : "api",
    userId: record.userId,
    authConfigId: record.authConfigId,
    status: typeof record.status === "string" ? record.status : "UNKNOWN",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

function emptyStore(): ConnectorStore {
  return {
    version: STORE_VERSION,
    connectors: {},
  };
}

import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import type { ViewerApi } from "./api.js";
import {
  createGlobalViewerApi,
  UnknownWikiError,
  UnreachableWikiError,
} from "./global-api.js";
import { readViewerAsset, readViewerIndex } from "./static.js";

export interface ViewerServerOptions {
  host?: string;
  port?: number;
}

export interface StartedViewerServer {
  url: string;
  close(): Promise<void>;
}

export async function startViewerServer(
  options: ViewerServerOptions,
): Promise<StartedViewerServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3927;
  const api = createGlobalViewerApi();

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${host}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(url, res, api);
        return;
      }
      await handleStatic(url, res);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : "internal server error",
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  return {
    url: `http://${address.address}:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    }),
  };
}

async function handleApi(
  url: URL,
  res: ServerResponse,
  api: ReturnType<typeof createGlobalViewerApi>,
): Promise<void> {
  if (url.pathname === "/api/wikis") {
    sendJson(res, 200, await api.wikis());
    return;
  }

  const wikiMatch = url.pathname.match(/^\/api\/wikis\/([^/]+)(\/.*)?$/);
  if (wikiMatch === null) {
    sendJson(res, 404, { error: "not found" });
    return;
  }

  const wikiName = decodeURIComponent(wikiMatch[1]!);
  const wikiPath = wikiMatch[2] ?? "";
  let wikiApi: ViewerApi;
  try {
    wikiApi = await api.forWiki(wikiName);
  } catch (error) {
    if (isUnknownWikiError(error)) {
      sendJson(res, 404, { error: error.message });
      return;
    }
    throw error;
  }

  if (wikiPath === "/overview") {
    sendJson(res, 200, await wikiApi.overview());
    return;
  }

  const pageMatch = wikiPath.match(/^\/page\/([^/]+)$/);
  if (pageMatch !== null) {
    const page = await wikiApi.page(decodeURIComponent(pageMatch[1]!));
    sendJson(res, page === null ? 404 : 200, page ?? { error: "page not found" });
    return;
  }

  const topicMatch = wikiPath.match(/^\/topic\/([^/]+)$/);
  if (topicMatch !== null) {
    const topic = await wikiApi.topic(decodeURIComponent(topicMatch[1]!));
    sendJson(res, topic === null ? 404 : 200, topic ?? { error: "topic not found" });
    return;
  }

  if (wikiPath === "/search") {
    sendJson(res, 200, await wikiApi.search(url.searchParams.get("q") ?? ""));
    return;
  }

  if (wikiPath === "/suggest") {
    sendJson(res, 200, await wikiApi.suggest(url.searchParams.get("q") ?? ""));
    return;
  }

  if (wikiPath === "/file") {
    sendJson(res, 200, await wikiApi.file(url.searchParams.get("path") ?? ""));
    return;
  }

  if (wikiPath === "/jobs") {
    sendJson(res, 200, await wikiApi.jobs());
    return;
  }

  const jobMatch = wikiPath.match(/^\/jobs\/([^/]+)$/);
  if (jobMatch !== null) {
    const job = await wikiApi.job(decodeURIComponent(jobMatch[1]!));
    sendJson(res, job === null ? 404 : 200, job ?? { error: "job not found" });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

async function handleStatic(url: URL, res: ServerResponse): Promise<void> {
  const asset = await readViewerAsset(url.pathname);
  if (asset !== null) {
    res.writeHead(200, {
      "content-type": asset.contentType,
      "cache-control": "no-store",
    });
    res.end(asset.body);
    return;
  }

  const index = await readViewerIndex();
  res.writeHead(200, {
    "content-type": index.contentType,
    "cache-control": "no-store",
  });
  res.end(index.body);
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(`${JSON.stringify(value)}\n`);
}

function isUnknownWikiError(error: unknown): error is Error {
  return error instanceof UnknownWikiError || error instanceof UnreachableWikiError;
}

export async function waitForInterrupt(): Promise<void> {
  await new Promise<void>((resolve) => {
    const done = () => {
      process.off("SIGINT", done);
      process.off("SIGTERM", done);
      resolve();
    };
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}

import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { createViewerApi } from "./api.js";
import { readViewerAsset, readViewerIndex } from "./static.js";

export interface ViewerServerOptions {
  repoRoot: string;
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
  const api = createViewerApi({ repoRoot: options.repoRoot });

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
  api: ReturnType<typeof createViewerApi>,
): Promise<void> {
  if (url.pathname === "/api/overview") {
    sendJson(res, 200, await api.overview());
    return;
  }

  const pageMatch = url.pathname.match(/^\/api\/page\/([^/]+)$/);
  if (pageMatch !== null) {
    const page = await api.page(decodeURIComponent(pageMatch[1]!));
    sendJson(res, page === null ? 404 : 200, page ?? { error: "page not found" });
    return;
  }

  const topicMatch = url.pathname.match(/^\/api\/topic\/([^/]+)$/);
  if (topicMatch !== null) {
    const topic = await api.topic(decodeURIComponent(topicMatch[1]!));
    sendJson(res, topic === null ? 404 : 200, topic ?? { error: "topic not found" });
    return;
  }

  if (url.pathname === "/api/search") {
    sendJson(res, 200, await api.search(url.searchParams.get("q") ?? ""));
    return;
  }

  if (url.pathname === "/api/file") {
    sendJson(res, 200, await api.file(url.searchParams.get("path") ?? ""));
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

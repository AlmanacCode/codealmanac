import { resolveWikiRoot } from "../indexer/resolve-wiki.js";
import { startViewerServer, waitForInterrupt } from "../viewer/server.js";

export interface ServeOptions {
  cwd: string;
  host?: string;
  port?: number;
}

export async function runServe(options: ServeOptions): Promise<void> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd });
  const server = await startViewerServer({
    repoRoot,
    host: options.host,
    port: options.port,
  });

  process.stdout.write(`almanac viewer: ${server.url}\n`);
  process.stdout.write("Press Ctrl+C to stop.\n");
  await waitForInterrupt();
  await server.close();
}

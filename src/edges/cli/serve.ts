import { startViewerServer } from "../viewer/server.js";
import { renderServeStartup, type ServeStartup } from "./serve-render.js";

export type { ServeStartup } from "./serve-render.js";

export type ServeWriter = (chunk: string) => void | Promise<void>;
export type ServeWaitForStop = () => Promise<void>;

export interface ServeOptions {
  host?: string;
  port?: number;
  write?: ServeWriter;
  waitForStop: ServeWaitForStop;
}

export async function runServe(options: ServeOptions): Promise<void> {
  const server = await startViewerServer({
    host: options.host,
    port: options.port,
  });

  try {
    await writeServeStartup(options.write, { url: server.url });
    await options.waitForStop();
  } finally {
    await server.close();
  }
}

async function writeServeStartup(
  write: ServeWriter | undefined,
  startup: ServeStartup,
): Promise<void> {
  if (write === undefined) return;
  await write(renderServeStartup(startup).stdout);
}

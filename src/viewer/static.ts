import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export async function readViewerAsset(pathname: string): Promise<{
  body: Buffer;
  contentType: string;
} | null> {
  const root = await findPackageRoot();
  const safePath = pathname === "/" ? "/index.html" : pathname;
  if (!/^\/[a-zA-Z0-9._/-]+$/.test(safePath) || safePath.includes("..")) {
    return null;
  }

  const filePath = join(root, "viewer", safePath);
  try {
    return {
      body: await readFile(filePath),
      contentType: contentTypeFor(filePath),
    };
  } catch {
    return null;
  }
}

export async function readViewerIndex(): Promise<{
  body: Buffer;
  contentType: string;
}> {
  const root = await findPackageRoot();
  return {
    body: await readFile(join(root, "viewer", "index.html")),
    contentType: "text/html; charset=utf-8",
  };
}

async function findPackageRoot(): Promise<string> {
  let dir = here;
  while (true) {
    try {
      await readFile(join(dir, "package.json"));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) throw new Error("could not locate codealmanac package root");
      dir = parent;
    }
  }
}

function contentTypeFor(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

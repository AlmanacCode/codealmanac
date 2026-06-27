import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate bundled setup guides relative to the installed package. This is
 * package-layout mechanics, so callers resolve it at the edge and pass the
 * resulting directory into setup services.
 */
export function resolveBundledGuidesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "..", "..", "guides"),
    path.resolve(here, "..", "..", "..", "guides"),
    path.resolve(here, "..", "..", "..", "..", "guides"),
  ];
  for (const dir of candidates) {
    if (looksLikeGuidesDir(dir)) return dir;
  }
  try {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve("codealmanac/package.json");
    const guides = path.join(path.dirname(pkgJson), "guides");
    if (looksLikeGuidesDir(guides)) return guides;
  } catch {
    // Fall through to the detailed error below.
  }
  throw new Error(
    "could not locate bundled guides/ directory. Tried:\n" +
      candidates.map((c) => `  - ${c}`).join("\n"),
  );
}

function looksLikeGuidesDir(dir: string): boolean {
  return existsSync(path.join(dir, "mini.md"));
}

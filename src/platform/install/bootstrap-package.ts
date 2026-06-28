import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isNewerVersion } from "../../shared/version.js";

export async function shouldInstallGlobalPackage(args: {
  currentRoot: string;
  globalRoot: string;
}): Promise<boolean> {
  const globalVersion = await readPackageVersion(args.globalRoot);
  if (globalVersion === null) return true;

  const currentVersion = await readPackageVersion(args.currentRoot);
  if (currentVersion === null) return false;

  return isNewerVersion(currentVersion, globalVersion);
}

export function samePackageRoot(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

export async function readPackageVersion(root: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(root, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version.length > 0
      ? parsed.version
      : null;
  } catch {
    return null;
  }
}

export function findCurrentPackageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Bundled: `.../codealmanac/dist/launcher.js` -> package root.
    path.resolve(here, ".."),
    // Old source/dist layout: `.../codealmanac/src/install/global.ts` -> package root.
    path.resolve(here, "..", ".."),
    // Source/dist platform layout: `.../codealmanac/src/platform/install/global.ts`.
    path.resolve(here, "..", "..", ".."),
  ];

  for (const candidate of candidates) {
    if (isCodealmanacPackageRoot(candidate)) return candidate;
  }

  return path.resolve(here, "..", "..", "..");
}

function isCodealmanacPackageRoot(candidate: string): boolean {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require(path.join(candidate, "package.json")) as {
      name?: unknown;
    };
    return pkg.name === "codealmanac";
  } catch {
    return false;
  }
}

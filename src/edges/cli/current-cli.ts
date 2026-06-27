import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function currentCliProgramArguments(): string[] {
  return [
    process.execPath,
    findPackageCliEntry() ?? currentCliEntrypointPath(),
  ];
}

function currentCliEntrypointPath(): string {
  if (process.argv[1] !== undefined && process.argv[1].length > 0) {
    return path.resolve(process.argv[1]);
  }
  return path.resolve(process.cwd(), "dist", "launcher.js");
}

function findPackageCliEntry(): string | null {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, "package.json");
    if (existsSync(pkg)) return path.join(dir, "dist", "launcher.js");
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

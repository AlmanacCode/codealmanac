import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { looksEphemeralInstallPath } from "../../install/ephemeral.js";

/**
 * Return the directory of the currently-running codealmanac install by
 * walking up from this module's file to the nearest `package.json` whose
 * `name` is `codealmanac`. Returns the empty string when the walk fails.
 */
export function detectCurrentInstallPath(): string {
  try {
    const req = createRequire(import.meta.url);
    const here = fileURLToPath(import.meta.url);
    let dir = path.dirname(here);
    for (let i = 0; i < 6; i++) {
      const pkgPath = path.join(dir, "package.json");
      try {
        const raw = req("fs").readFileSync(pkgPath, "utf-8") as string;
        const pkg = JSON.parse(raw) as { name?: unknown };
        if (pkg.name === "codealmanac") return dir;
      } catch {
        // keep walking
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // import.meta.url unavailable — not ephemeral for our purposes.
  }
  return "";
}

/**
 * Return true when the given install path looks ephemeral.
 *
 * Ephemeral locations we recognize:
 *   - `~/.npm/_npx/` — npm's npx cache (GC'd on version bumps or
 *     `npm cache clean`)
 *   - `~/.local/share/pnpm/dlx/` — pnpm's dlx (like npx) cache
 *   - `/tmp/`, `/var/folders/`, `%TEMP%`, `%TMP%` — common temp paths
 *
 * A global install (`~/.nvm/.../lib/node_modules/`, `/usr/local/lib/...`,
 * `~/.local/lib/node_modules/`) is NOT ephemeral.
 */
export function detectEphemeral(installPath: string): boolean {
  return looksEphemeralInstallPath(installPath);
}

/**
 * Spawn `npm install -g codealmanac@latest` in a child process and wait
 * for it to finish. Rejects on non-zero exit or spawn error.
 */
export function spawnGlobalInstall(): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = globalInstallCommand();
    execFile(
      command.file,
      command.args,
      { shell: false },
      (err, _stdout, stderr) => {
        if (err !== null) {
          reject(
            new Error(
              stderr.length > 0
                ? stderr.trim().split("\n")[0] ?? err.message
                : err.message,
            ),
          );
        } else {
          resolve();
        }
      },
    );
  });
}

export function globalInstallCommand(
  platform: NodeJS.Platform = process.platform,
): { file: string; args: string[] } {
  if (platform === "win32") {
    return {
      file: "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd install -g codealmanac@latest"],
    };
  }
  return { file: "npm", args: ["install", "-g", "codealmanac@latest"] };
}

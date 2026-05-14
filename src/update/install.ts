import { spawn, type SpawnOptions } from "node:child_process";

import type { CommandResult } from "../cli/helpers.js";

export interface InstallLatestPackageOptions {
  spawnFn?: typeof spawn;
}

export async function installLatestPackage(
  options: InstallLatestPackageOptions = {},
): Promise<CommandResult> {
  const spawnFn = options.spawnFn ?? spawn;
  const spawnOpts: SpawnOptions = { stdio: "inherit" };

  return await new Promise<CommandResult>((resolve) => {
    const child = spawnFn(
      "npm",
      ["i", "-g", "codealmanac@latest"],
      spawnOpts,
    );

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        resolve({
          stdout: "",
          stderr:
            "almanac: `npm` not found on PATH. " +
            "Install Node.js + npm, or install the codealmanac package via your package manager.\n",
          exitCode: 1,
        });
        return;
      }
      resolve({
        stdout: "",
        stderr: `almanac: failed to run npm: ${err.message}\n`,
        exitCode: 1,
      });
    });

    child.on("exit", (code) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        resolve({
          stdout: "",
          stderr:
            `almanac: npm install failed (exit ${exitCode}).\n` +
            `If you see "EACCES" above, try: sudo npm i -g codealmanac@latest\n` +
            `Or install with a version manager (nvm, volta, fnm) to avoid sudo.\n`,
          exitCode,
        });
        return;
      }
      resolve({
        stdout: "almanac: updated.\n",
        stderr: "",
        exitCode: 0,
      });
    });
  });
}

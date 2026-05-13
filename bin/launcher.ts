import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatMissingPinnedNodeMessage,
  isUsablePinnedNode,
  readInstallRuntimeSync,
} from "../src/install/launcher-runtime.js";

const distDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(distDir, "..");
const entrypoint = path.join(distDir, "codealmanac.js");
const runtime = readInstallRuntimeSync(packageRoot);
const invokedAs = path.basename(process.argv[1] ?? "almanac");

if (runtime !== null && !isUsablePinnedNode(runtime)) {
  process.stderr.write(formatMissingPinnedNodeMessage(runtime));
  process.exit(1);
}

const nodePath = runtime?.nodePath ?? process.execPath;
const result = spawnSync(nodePath, [entrypoint, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    CODEALMANAC_INVOKED_AS: invokedAs,
  },
});

if (result.error !== undefined) {
  process.stderr.write(`almanac: failed to launch pinned Node: ${result.error.message}\n`);
  process.exit(1);
}

if (result.signal !== null) {
  process.kill(process.pid, result.signal);
}

process.exit(result.status ?? 1);

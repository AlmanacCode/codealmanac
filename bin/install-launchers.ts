import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeInstallRuntime } from "../src/install/launcher-runtime.js";

const distDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(distDir, "..");

await writeInstallRuntime({
  packageRoot,
  nodePath: process.execPath,
  nodeVersion: process.version,
  nodeAbi: process.versions.modules ?? null,
});

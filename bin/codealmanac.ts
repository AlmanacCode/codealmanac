import { checkSqliteAbi } from "../src/abi-guard.js";

// ABI guard: detect better-sqlite3 binding mismatch before any command
// runs. When the binary was compiled for a different Node ABI (common
// after switching Node versions via nvm/volta/fnm), the native binding
// throws a cryptic NODE_MODULE_VERSION error the first time any indexer
// code touches it. The guard catches it here, at the entry point, and
// emits a human-readable message with a concrete fix before exiting.
// This is bug #3 from codealmanac-known-bugs.md.
const abiError = checkSqliteAbi();
if (abiError !== null) {
  process.stderr.write(`almanac: ${abiError}\n`);
  process.exit(1);
}

const { run } = await import("../src/cli.js");

run(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`almanac: ${message}\n`);
  process.exit(1);
});

import { checkSqliteAbi } from "../src/abi-guard.js";

// ABI guard: detect better-sqlite3 binding mismatch before commands that may
// touch the indexer. Skip setup/version/update-only paths so a fresh
// `almanac` setup or `npx codealmanac` bootstrap can install/fix itself even
// when the native binding is broken.
if (shouldCheckSqliteAbi(process.argv)) {
  const abiError = checkSqliteAbi();
  if (abiError !== null) {
    process.stderr.write(`almanac: ${abiError}\n`);
    process.exit(1);
  }
}

const { run } = await import("../src/cli.js");

run(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`almanac: ${message}\n`);
  process.exit(1);
});

function shouldCheckSqliteAbi(argv: string[]): boolean {
  const invoked = argv[1]?.split(/[\\/]/).pop() ?? "almanac";
  const args = argv.slice(2);

  if (args.includes("--internal-check-updates")) return false;
  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
    return false;
  }

  if (invoked === "almanac" || invoked === "codealmanac") {
    if (args.length === 0) return false;
    if (
      args.every((arg) =>
        arg === "--yes" ||
        arg === "-y" ||
        arg === "--skip-hook" ||
        arg === "--skip-guides"
      )
    ) {
      return false;
    }
  }

  const sqliteFreeCommands = new Set([
    "setup",
    "hook",
    "uninstall",
    "update",
    "doctor",
  ]);
  const firstCommand = args.find((arg) => !arg.startsWith("-"));
  return firstCommand === undefined || !sqliteFreeCommands.has(firstCommand);
}

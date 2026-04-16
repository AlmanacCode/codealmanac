import { run } from "../src/cli.js";

run(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`almanac: ${message}\n`);
  process.exit(1);
});

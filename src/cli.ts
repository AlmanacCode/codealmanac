import { Command } from "commander";

import { initWiki } from "./commands/init.js";
import { listWikis } from "./commands/list.js";
import { autoRegisterIfNeeded } from "./registry/autoregister.js";

/**
 * Entry point. `bin/codealmanac.ts` hands us `process.argv` and any errors
 * bubble up to the shim for a uniform "almanac: <message>" output format.
 *
 * Auto-registration runs before most commands. Two exceptions:
 *   - `init` registers explicitly, so auto-register would be redundant and
 *     would race with init's own write.
 *   - `list --drop <name>` shouldn't silently re-register the repo whose
 *     entry the user is trying to remove.
 */
export async function run(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("almanac")
    .description(
      "codealmanac — a living wiki for codebases, maintained by AI agents",
    )
    .version("0.1.0", "-v, --version", "print version");

  program
    .command("init")
    .description("scaffold .almanac/ in the current directory and register it")
    .option("--name <name>", "wiki name (defaults to the directory name)")
    .option("--description <text>", "one-line description of this wiki")
    .action(async (opts: { name?: string; description?: string }) => {
      const result = await initWiki({
        cwd: process.cwd(),
        name: opts.name,
        description: opts.description,
      });
      const verb = result.created ? "initialized" : "updated";
      process.stdout.write(
        `${verb} wiki "${result.entry.name}" at ${result.almanacDir}\n`,
      );
    });

  program
    .command("list")
    .description("list registered wikis")
    .option("--json", "emit structured JSON")
    .option(
      "--drop <name>",
      "remove a wiki from the registry (the only way entries are ever removed)",
    )
    .action(async (opts: { json?: boolean; drop?: string }) => {
      // Auto-register only makes sense for default/JSON listing. Skipping
      // it on --drop keeps the removal operation predictable — the user's
      // intent is to shrink the registry, not grow it mid-command.
      if (opts.drop === undefined) {
        await autoRegisterIfNeeded(process.cwd());
      }
      const result = await listWikis(opts);
      process.stdout.write(result.stdout);
      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    });

  await program.parseAsync(argv);
}

import { Command } from "commander";

import { createCliRuntime } from "../../app/cli-runtime.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";
import { currentCliNodeProgram } from "./current-cli.js";
import { emit } from "./helpers.js";
import { lifecycleForegroundEventHandler } from "./lifecycle-events.js";

export function registerGardenCommand(program: Command): void {
  program
    .command("garden")
    .description("maintain wiki structure, links, topics, and source hygiene")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--foreground", "run now instead of starting a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("-y, --yes", "confirm non-interactively")
    .option("--verbose", "stream agent activity while the run is attached")
    .action(
      async (opts: {
        using?: string;
        foreground?: boolean;
        json?: boolean;
        yes?: boolean;
        verbose?: boolean;
      }) => {
        await autoRegisterIfNeeded(process.cwd());
        const runtime = createCliRuntime({ environment: process.env });
        const { runGardenCommand } = await import("./commands/operations.js");
        const result = await runGardenCommand({
          cwd: process.cwd(),
          using: opts.using,
          foreground: opts.foreground,
          json: opts.json,
          yes: opts.yes,
          workerProgram: currentCliNodeProgram(),
          workerEnvironment: runtime.workerEnvironment,
          pid: process.pid,
          isPidAlive: runtime.isPidAlive,
          agentRunner: runtime.agentRunner,
          loadPrompt: runtime.loadPrompt,
          startBackground: runtime.startBackground,
          onEvent: opts.foreground === true
            ? lifecycleForegroundEventHandler(opts)
            : undefined,
        });
        emit(result);
      },
    );
}

import { Command } from "commander";

import { createCliRuntime } from "../../app/cli-runtime.js";
import { currentCliNodeProgram } from "./current-cli.js";
import { emit } from "./helpers.js";
import {
  initStartMessage,
  lifecycleForegroundEventHandler,
} from "./lifecycle-events.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("initialize and build this repo's Almanac wiki")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--background", "start as a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("--force", "allow rebuilding an existing wiki")
    .option("-y, --yes", "confirm non-interactively")
    .option("--verbose", "stream agent activity while the run is attached")
    .action(
      async (opts: {
        using?: string;
        background?: boolean;
        json?: boolean;
        force?: boolean;
        yes?: boolean;
        verbose?: boolean;
      }) => {
        const start = initStartMessage(opts);
        if (start !== null) process.stdout.write(start);
        const runtime = createCliRuntime({ environment: process.env });

        const { runInitCommand } = await import("./commands/operations.js");
        const result = await runInitCommand({
          cwd: process.cwd(),
          using: opts.using,
          background: opts.background,
          json: opts.json,
          force: opts.force,
          yes: opts.yes,
          workerProgram: currentCliNodeProgram(),
          workerEnvironment: runtime.workerEnvironment,
          pid: process.pid,
          isPidAlive: runtime.isPidAlive,
          agentRunner: runtime.agentRunner,
          loadPrompt: runtime.loadPrompt,
          startBackground: runtime.startBackground,
          onEvent: opts.background === true
            ? undefined
            : lifecycleForegroundEventHandler(opts),
        });
        emit(result);
      },
    );
}

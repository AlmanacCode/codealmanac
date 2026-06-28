import { Command } from "commander";

import { createCliRuntime } from "../../app/cli-runtime.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";
import { currentCliNodeProgram } from "./current-cli.js";
import { emit } from "./helpers.js";
import { lifecycleForegroundEventHandler } from "./lifecycle-events.js";

export function registerAbsorbCommand(program: Command): void {
  registerAbsorbLikeCommand(program, {
    name: "absorb",
    description:
      "update the wiki from explicit files, folders, PRs, issues, or URLs",
  });
}

export function registerIngestCommand(program: Command): void {
  registerAbsorbLikeCommand(program, {
    name: "ingest",
    description: "alias for absorb",
  });
}

function registerAbsorbLikeCommand(
  program: Command,
  command: {
    name: "absorb" | "ingest";
    description: string;
  },
): void {
  program
    .command(`${command.name} <inputs...>`)
    .description(command.description)
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--foreground", "run now instead of starting a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("-y, --yes", "confirm non-interactively")
    .option("--verbose", "stream agent activity while the run is attached")
    .action(
      async (
        inputs: string[],
        opts: {
          using?: string;
          foreground?: boolean;
          json?: boolean;
          yes?: boolean;
          verbose?: boolean;
        },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const runtime = createCliRuntime({ environment: process.env });
        const { runAbsorbCommand } = await import("./commands/operations.js");
        const result = await runAbsorbCommand({
          cwd: process.cwd(),
          inputs,
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
          resolveSource: runtime.resolveAbsorbSource,
          onEvent: opts.foreground === true
            ? lifecycleForegroundEventHandler(opts)
            : undefined,
        });
        emit(result);
      },
    );
}

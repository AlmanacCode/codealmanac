import { Command } from "commander";

import { createAgentRuntimeJobRunner } from "../../agent/runtime/job-runner.js";
import { currentCliNodeProgram } from "./current-cli.js";
import { emit } from "./helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

import {
  initStartMessage,
  lifecycleForegroundEventHandler,
} from "./lifecycle-events.js";

export function registerLifecycleRunCommands(program: Command): void {
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

        const { runInitCommand } = await import("../../cli/commands/operations.js");
        const result = await runInitCommand({
          cwd: process.cwd(),
          using: opts.using,
          background: opts.background,
          json: opts.json,
          force: opts.force,
          yes: opts.yes,
          workerProgram: currentCliNodeProgram(),
          workerEnvironment: process.env,
          pid: process.pid,
          agentRunner: createAgentRuntimeJobRunner({ environment: process.env }),
          onEvent: opts.background === true
            ? undefined
            : lifecycleForegroundEventHandler(opts),
        });
        emit(result);
      },
    );

  registerAbsorbCommand(program);
  registerIngestCommand(program);
}

function registerAbsorbCommand(program: Command): void {
  program
    .command("absorb <inputs...>")
    .description("update the wiki from explicit files, folders, PRs, issues, or URLs")
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
        const { runAbsorbCommand } = await import("../../cli/commands/operations.js");
        const result = await runAbsorbCommand({
          cwd: process.cwd(),
          inputs,
          using: opts.using,
          foreground: opts.foreground,
          json: opts.json,
          yes: opts.yes,
          workerProgram: currentCliNodeProgram(),
          workerEnvironment: process.env,
          pid: process.pid,
          agentRunner: createAgentRuntimeJobRunner({ environment: process.env }),
          onEvent: opts.foreground === true
            ? lifecycleForegroundEventHandler(opts)
            : undefined,
        });
        emit(result);
      },
    );
}

function registerIngestCommand(program: Command): void {
  program
    .command("ingest <inputs...>")
    .description("alias for absorb")
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
        const { runAbsorbCommand } = await import("../../cli/commands/operations.js");
        const result = await runAbsorbCommand({
          cwd: process.cwd(),
          inputs,
          using: opts.using,
          foreground: opts.foreground,
          json: opts.json,
          yes: opts.yes,
          workerProgram: currentCliNodeProgram(),
          workerEnvironment: process.env,
          pid: process.pid,
          agentRunner: createAgentRuntimeJobRunner({ environment: process.env }),
          onEvent: opts.foreground === true
            ? lifecycleForegroundEventHandler(opts)
            : undefined,
        });
        emit(result);
      },
    );
}

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
        const { runGardenCommand } = await import("../../cli/commands/operations.js");
        const result = await runGardenCommand({
          cwd: process.cwd(),
          using: opts.using,
          foreground: opts.foreground,
          json: opts.json,
          yes: opts.yes,
          workerProgram: currentCliNodeProgram(),
          workerEnvironment: process.env,
          pid: process.pid,
          agentRunner: createAgentRuntimeJobRunner({ environment: process.env }),
          onEvent: opts.foreground === true
            ? lifecycleForegroundEventHandler(opts)
            : undefined,
        });
        emit(result);
      },
    );
}

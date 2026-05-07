import { Command } from "commander";

import { runBootstrap } from "../commands/bootstrap.js";
import { runCapture } from "../commands/capture.js";
import { runCaptureStatus } from "../commands/captureStatus.js";
import {
  runHookInstall,
  runHookStatus,
  runHookUninstall,
} from "../commands/hook.js";
import { runReindex } from "../commands/reindex.js";
import { autoRegisterIfNeeded } from "../registry/autoregister.js";
import { emit } from "./helpers.js";

export function registerWikiLifecycleCommands(program: Command): void {
  program
    .command("bootstrap")
    .description(
      "scaffold a wiki in this repo via an AI agent (requires ANTHROPIC_API_KEY or Claude subscription)",
    )
    .option("--quiet", "suppress per-tool streaming; print only the final line")
    .option("--model <model>", "override the agent model")
    .option("--force", "overwrite an existing populated wiki (default: refuse)")
    .action(
      async (opts: { quiet?: boolean; model?: string; force?: boolean }) => {
        const result = await runBootstrap({
          cwd: process.cwd(),
          quiet: opts.quiet,
          model: opts.model,
          force: opts.force,
        });
        emit(result);
      },
    );

  const capture = program
    .command("capture [transcript]")
    .alias("c")
    .description("run the writer/reviewer pipeline on a session (usually automatic)")
    .option("--session <id>", "target a specific session by ID")
    .option("--quiet", "suppress per-tool streaming; print only the final summary")
    .option("--model <model>", "override the agent model")
    .action(
      async (
        transcript: string | undefined,
        opts: { session?: string; quiet?: boolean; model?: string },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runCapture({
          cwd: process.cwd(),
          transcriptPath: transcript,
          sessionId: opts.session,
          quiet: opts.quiet,
          model: opts.model,
        });
        emit(result);
      },
    );

  capture
    .command("status")
    .description("show running and recent capture jobs")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      await autoRegisterIfNeeded(process.cwd());
      const result = await runCaptureStatus({
        cwd: process.cwd(),
        json: opts.json,
      });
      emit(result);
    });

  program
    .command("ps")
    .description("show running and recent capture jobs")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      await autoRegisterIfNeeded(process.cwd());
      const result = await runCaptureStatus({
        cwd: process.cwd(),
        json: opts.json,
      });
      emit(result);
    });

  const hook = program
    .command("hook")
    .description("manage the SessionEnd auto-capture hook");

  hook
    .command("install")
    .description("add a SessionEnd entry that runs 'almanac capture' on session end")
    .action(async () => {
      const result = await runHookInstall();
      emit(result);
    });

  hook
    .command("uninstall")
    .description("remove codealmanac's SessionEnd entry; leaves foreign entries alone")
    .action(async () => {
      const result = await runHookUninstall();
      emit(result);
    });

  hook
    .command("status")
    .description("report whether the SessionEnd hook is installed")
    .action(async () => {
      const result = await runHookStatus();
      emit(result);
    });

  program
    .command("reindex")
    .description("force a full rebuild of .almanac/index.db")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const result = await runReindex({
        cwd: process.cwd(),
        wiki: opts.wiki,
      });
      process.stdout.write(result.stdout);
      if (result.exitCode !== 0) process.exitCode = result.exitCode;
    });
}

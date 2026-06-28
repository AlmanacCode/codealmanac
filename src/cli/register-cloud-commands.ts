import { Command } from "commander";

import { emit, readStdin } from "./helpers.js";
import type { CloudHookEvent, CloudProvider } from "../cloud/types.js";

export function registerCloudCommands(program: Command): void {
  program
    .command("login")
    .description("log in to Almanac Cloud")
    .action(async () => {
      const { runCloudLogin } = await import("./commands/cloud.js");
      emit(await runCloudLogin());
    });

  program
    .command("logout")
    .description("log out of Almanac Cloud")
    .action(async () => {
      const { runCloudLogout } = await import("./commands/cloud.js");
      emit(await runCloudLogout());
    });

  const cloud = program
    .command("cloud")
    .description("Almanac Cloud commands");

  cloud
    .command("status")
    .description("show Almanac Cloud login and repository status")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      const { runCloudStatus } = await import("./commands/cloud.js");
      emit(await runCloudStatus({ json: opts.json }));
    });

  cloud
    .command("capture-hook")
    .description("internal hook entrypoint for hosted conversation capture")
    .requiredOption("--provider <provider>", "codex or claude")
    .requiredOption("--event <event>", "UserPromptSubmit or Stop")
    .option("--json", "emit structured JSON")
    .action(async (opts: { provider: string; event: string; json?: boolean }) => {
      const { runCloudCaptureHook } = await import("./commands/cloud.js");
      emit(await runCloudCaptureHook({
        provider: parseProvider(opts.provider),
        event: parseHookEvent(opts.event),
        stdin: await readStdin(),
        json: opts.json,
      }));
    });
}

function parseProvider(value: string): CloudProvider {
  if (value === "codex" || value === "claude") return value;
  throw new Error(`invalid --provider "${value}"`);
}

function parseHookEvent(value: string): CloudHookEvent {
  if (value === "UserPromptSubmit" || value === "Stop") return value;
  throw new Error(`invalid --event "${value}"`);
}

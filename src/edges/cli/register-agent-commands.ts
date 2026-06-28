import { Command } from "commander";

import { emit } from "./helpers.js";
import { createAgentReadinessRuntime } from "../../app/agent-readiness-runtime.js";

export function registerAgentCommands(program: Command): void {
  const agents = program
    .command("agents")
    .description("list supported AI agent providers and readiness");

  agents
    .command("list")
    .description("show Claude, Codex, and Cursor provider status")
    .action(async () => {
      const { runAgentsList } = await import("./commands/agents/read.js");
      emit(await runAgentsList({
        environment: process.env,
        readinessRuntime: createAgentReadinessRuntime(),
      }));
    });

  agents
    .command("doctor")
    .description("diagnose supported AI agent providers")
    .action(async () => {
      const { runAgentsDoctor } = await import("./commands/agents/read.js");
      emit(await runAgentsDoctor({
        environment: process.env,
        readinessRuntime: createAgentReadinessRuntime(),
      }));
    });

  agents
    .command("use")
    .description("set the default AI agent provider")
    .argument("<provider>", "claude, codex, cursor, or claude/<model>")
    .action(async (provider: string) => {
      const { runAgentsUse } = await import("./commands/agents/default.js");
      emit(await runAgentsUse({ provider, cwd: process.cwd() }));
    });

  agents
    .command("model")
    .description("set or reset a provider model")
    .argument("<provider>", "claude, codex, or cursor")
    .argument("[model]", "provider-specific model id")
    .option("--default", "reset to provider default")
    .action(async (
      provider: string,
      model: string | undefined,
      opts: { default?: boolean },
    ) => {
      const { runAgentsModel } = await import("./commands/agents/model.js");
      emit(await runAgentsModel({
        provider,
        model,
        defaultModel: opts.default,
        cwd: process.cwd(),
      }));
    });
}

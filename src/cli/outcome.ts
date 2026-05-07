import type { CommandResult } from "./helpers.js";

export type CommandOutcome =
  | {
      type: "success";
      message: string;
      data?: Record<string, unknown>;
    }
  | {
      type: "noop";
      message: string;
      data?: Record<string, unknown>;
    }
  | {
      type: "needs-action";
      message: string;
      fix: string;
      data?: Record<string, unknown>;
    }
  | {
      type: "error";
      message: string;
      data?: Record<string, unknown>;
    };

export function renderOutcome(
  outcome: CommandOutcome,
  opts: { json?: boolean; exitCode?: number; stdout?: string } = {},
): CommandResult {
  const exitCode = opts.exitCode ?? defaultExitCode(outcome);
  if (opts.json === true) {
    return {
      stdout: `${JSON.stringify(outcome, null, 2)}\n`,
      stderr: "",
      exitCode,
    };
  }
  if (outcome.type === "needs-action") {
    return {
      stdout: opts.stdout ?? "",
      stderr: `almanac: ${outcome.message}\n${outcome.fix}\n`,
      exitCode,
    };
  }
  if (outcome.type === "error") {
    return {
      stdout: opts.stdout ?? "",
      stderr: `almanac: ${outcome.message}\n`,
      exitCode,
    };
  }
  return {
    stdout: opts.stdout ?? `${outcome.message}\n`,
    stderr: "",
    exitCode,
  };
}

function defaultExitCode(outcome: CommandOutcome): number {
  switch (outcome.type) {
    case "success":
    case "noop":
      return 0;
    case "needs-action":
    case "error":
      return 1;
  }
}

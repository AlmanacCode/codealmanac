import { UserFacingError } from "../errors.js";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

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

export function renderError(
  err: unknown,
  opts: { json?: boolean; exitCode?: number; stdout?: string } = {},
): CommandResult {
  return renderOutcome(outcomeFromError(err), opts);
}

export function renderErrorText(err: unknown): string {
  const outcome = outcomeFromError(err);
  if (outcome.type === "needs-action") {
    return `almanac: ${outcome.message}\n${outcome.fix}\n`;
  }
  return `almanac: ${outcome.message}\n`;
}

function outcomeFromError(
  err: unknown,
): Extract<CommandOutcome, { type: "error" | "needs-action" }> {
  if (err instanceof UserFacingError) {
    if (err.outcome === "needs-action" && err.fix !== undefined) {
      return {
        type: "needs-action",
        message: err.message,
        fix: err.fix,
        data: err.data,
      };
    }
    return { type: "error", message: err.message, data: err.data };
  }
  return {
    type: "error",
    message: err instanceof Error ? err.message : String(err),
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

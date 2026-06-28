import { splitFlagValue } from "./flag-value.js";

export interface AutomationInstallFlagOptions {
  every?: string;
  quiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
}

export type AutomationInstallFlagParseResult =
  | {
    ok: true;
    options: AutomationInstallFlagOptions;
    tasks: string[];
  }
  | {
    ok: false;
    error: string;
  };

export function parseAutomationInstallFlags(
  args: string[],
): AutomationInstallFlagParseResult {
  const options: AutomationInstallFlagOptions = {};
  const tasks: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const parsed = splitFlagValue(args[i]!);
    const arg = parsed.flag;
    if (arg === "--garden-off" && parsed.value === undefined) {
      options.gardenOff = true;
      continue;
    }
    if (arg !== "--every" && arg !== "--quiet" && arg !== "--garden-every") {
      tasks.push(args[i]!);
      continue;
    }

    const value = parsed.value ?? args[i + 1];
    if (value === undefined || value.startsWith("-")) {
      return { ok: false, error: `missing value for ${arg}` };
    }

    if (arg === "--every") {
      options.every = value;
    } else if (arg === "--quiet") {
      options.quiet = value;
    } else {
      options.gardenEvery = value;
    }
    if (parsed.value === undefined) i++;
  }

  return { ok: true, options, tasks };
}

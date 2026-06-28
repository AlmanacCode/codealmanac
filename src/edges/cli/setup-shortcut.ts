import { splitFlagValue } from "./flag-value.js";

export interface SetupShortcutOptions {
  yes?: boolean;
  agent?: string;
  model?: string;
  skipAutomation?: boolean;
  automationEvery?: string;
  automationQuiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  autoUpdate?: boolean;
  autoUpdateEvery?: string;
  skipGuides?: boolean;
  autoCommit?: boolean;
}

/**
 * Decide whether a bare `almanac [...args]` invocation should route
 * straight to setup. Returns options when it is a setup shortcut, or
 * `null` when Commander should parse the invocation normally.
 */
export function tryParseSetupShortcut(
  args: string[],
): SetupShortcutOptions | null {
  if (args.length === 0) return {};
  return parseSetupShortcutFlags(args);
}

function parseSetupShortcutFlags(args: string[]): SetupShortcutOptions | null {
  const opts: SetupShortcutOptions = {};
  for (let i = 0; i < args.length; i++) {
    const parsed = splitFlagValue(args[i]!);
    const arg = parsed.flag;
    if (arg === "--yes" || arg === "-y") {
      opts.yes = true;
      continue;
    }
    if (arg === "--agent") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.agent = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--model") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.model = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--skip-automation" && parsed.value === undefined) {
      opts.skipAutomation = true;
      continue;
    }
    if (arg === "--sync-every") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.automationEvery = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--sync-quiet") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.automationQuiet = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--garden-every") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.gardenEvery = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--garden-off" && parsed.value === undefined) {
      opts.gardenOff = true;
      continue;
    }
    if (arg === "--auto-update" && parsed.value === undefined) {
      opts.autoUpdate = true;
      continue;
    }
    if (arg === "--auto-update-every") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.autoUpdateEvery = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--skip-guides" && parsed.value === undefined) {
      opts.skipGuides = true;
      continue;
    }
    if (arg === "--auto-commit" && parsed.value === undefined) {
      opts.autoCommit = true;
      continue;
    }
    if (arg === "--no-auto-commit" && parsed.value === undefined) {
      opts.autoCommit = false;
      continue;
    }
    return null;
  }
  return opts;
}

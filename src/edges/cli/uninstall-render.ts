import { makeAnsiTheme, type AnsiTheme } from "../../ansi-theme.js";
import type { SetupUninstallResult } from "../../services/setup/index.js";

type CheckedAutomation = Extract<
  SetupUninstallResult["automation"],
  { action: "checked" }
>;

export interface UninstallRenderOptions {
  color?: boolean;
}

export function renderUninstallStart(): string {
  return "\n";
}

export function renderAutomationKept(
  options: UninstallRenderOptions = {},
): string {
  const theme = themeFor(options);
  return `  ${theme.DIM}\u25cb  Scheduled automation kept${theme.RST}\n`;
}

export function renderGuidesKept(
  options: UninstallRenderOptions = {},
): string {
  const theme = themeFor(options);
  return `  ${theme.DIM}\u25cb  Guides kept${theme.RST}\n`;
}

export function renderUninstallResult(
  result: SetupUninstallResult,
  options: UninstallRenderOptions = {},
): string {
  const theme = themeFor(options);
  return renderAutomationResult(result.automation, theme) +
    renderGuidesResult(result.guides, theme);
}

export function renderUninstallComplete(
  options: UninstallRenderOptions = {},
): string {
  const theme = themeFor(options);
  const icon = `${theme.BLUE}\u25c7${theme.RST}`;
  const label = `${theme.BLUE}Uninstall complete${theme.RST}`;
  return `\n  ${icon}  ${label}\n\n`;
}

export function renderConfirmationPrompt(
  question: string,
  defaultYes: boolean,
  options: UninstallRenderOptions = {},
): string {
  const theme = themeFor(options);
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const icon = `${theme.BLUE}\u25c6${theme.RST}`;
  const dimHint = `${theme.DIM}${hint}${theme.RST}`;
  return `  ${icon}  ${question} ${dimHint} `;
}

function renderAutomationResult(
  result: SetupUninstallResult["automation"],
  theme: AnsiTheme,
): string {
  if (result.action !== "checked") return "";

  return `  ${theme.BLUE}\u25c7${theme.RST}  ${formatAutomationResult(result)}\n`;
}

function renderGuidesResult(
  result: SetupUninstallResult["guides"],
  theme: AnsiTheme,
): string {
  if (result.action !== "checked") return "";

  if (!result.anyChanges) {
    return `  ${theme.DIM}\u25cb  Guides not installed${theme.RST}\n`;
  }

  return (
    `  ${theme.BLUE}\u25c7${theme.RST}  Guides removed (` +
    `${result.filesTouched.join(", ")})\n`
  );
}

function themeFor(options: UninstallRenderOptions): AnsiTheme {
  return makeAnsiTheme(options.color === true);
}

function formatAutomationResult(result: CheckedAutomation): string {
  if (result.status === "not-installed") {
    return "almanac: automation not installed";
  }

  return (
    "almanac: automation removed\n" +
    result.plistPaths.map((pathValue) => `  plist: ${pathValue}\n`).join("")
  ).trim();
}

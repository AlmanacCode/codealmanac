import { makeAnsiTheme, type AnsiTheme } from "../../../../shared/ansi-theme.js";
import type {
  AgentDoctorCheck,
  Check,
  CheckStatus,
  DoctorReport,
} from "../../../../services/diagnostics/index.js";

export interface DoctorFormatOptions {
  color?: boolean;
}

export function formatReport(
  report: DoctorReport,
  options: DoctorFormatOptions = {},
): string {
  const theme = makeAnsiTheme(options.color === true);
  const lines: string[] = [];
  lines.push(`Almanac v${report.version}`);
  lines.push("");
  if (report.install.length > 0) {
    lines.push(formatHeading("Install", theme));
    for (const c of report.install) {
      lines.push(formatCheck(c, theme));
    }
    lines.push("");
  }
  if (report.agents.length > 0) {
    lines.push(formatHeading("Agents", theme));
    for (const c of report.agents.map(agentToCheck)) {
      lines.push(formatCheck(c, theme));
    }
    lines.push("");
  }
  if (report.updates.length > 0) {
    lines.push(formatHeading("Updates", theme));
    for (const c of report.updates) {
      lines.push(formatCheck(c, theme));
    }
    lines.push("");
  }
  if (report.wiki.length > 0) {
    lines.push(formatHeading("Current wiki", theme));
    for (const c of report.wiki) {
      lines.push(formatCheck(c, theme));
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function formatHeading(label: string, theme: AnsiTheme): string {
  return `${theme.BOLD}## ${label}${theme.RST}`;
}

function agentToCheck(agent: AgentDoctorCheck): Check {
  const message = [
    agent.label,
    agent.selected ? "(default)" : null,
    agent.recommended ? "(recommended)" : null,
    agent.status === "ok" ? "ready" : readinessMessage(agent),
    `model: ${agent.model ?? "provider default"}`,
    agent.account,
  ].filter((part): part is string => part !== null).join(" ");
  return {
    status: agent.status,
    key: `agents.${agent.id}`,
    message,
    fix: agent.fix,
  };
}

function readinessMessage(agent: AgentDoctorCheck): string {
  if (!agent.installed) return "missing";
  if (!agent.authenticated) return `not ready: ${agent.detail}`;
  return agent.detail;
}

function formatCheck(c: Check, theme: AnsiTheme): string {
  const { icon, tint } = iconFor(c.status, theme);
  const head = `  ${tint}${icon}${theme.RST} ${c.message}`;
  if (c.fix === undefined) return head;
  const fixLine = `    ${theme.DIM}${c.fix}${theme.RST}`;
  return `${head}\n${fixLine}`;
}

function iconFor(
  status: CheckStatus,
  theme: AnsiTheme,
): { icon: string; tint: string } {
  switch (status) {
    case "ok":
      return { icon: "\u2713", tint: theme.GREEN };
    case "problem":
      return { icon: "\u2717", tint: theme.RED };
    case "info":
      return { icon: "\u25c7", tint: theme.BLUE };
  }
}

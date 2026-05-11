import { BLUE, BOLD, DIM, GREEN, RED, RST } from "../../ansi.js";
import type {
  AgentDoctorCheck,
  Check,
  CheckStatus,
  DoctorOptions,
  DoctorReport,
} from "./types.js";

export function formatReport(
  report: DoctorReport,
  options: DoctorOptions,
): string {
  const color = options.stdout === undefined && process.stdout.isTTY === true;
  const lines: string[] = [];
  lines.push(`Almanac v${report.version}`);
  lines.push("");
  if (report.install.length > 0) {
    lines.push(color ? `${BOLD}## Install${RST}` : "## Install");
    for (const c of report.install) {
      lines.push(formatCheck(c, color));
    }
    lines.push("");
  }
  if (report.agents.length > 0) {
    lines.push(color ? `${BOLD}## Agents${RST}` : "## Agents");
    for (const c of report.agents.map(agentToCheck)) {
      lines.push(formatCheck(c, color));
    }
    lines.push("");
  }
  if (report.updates.length > 0) {
    lines.push(color ? `${BOLD}## Updates${RST}` : "## Updates");
    for (const c of report.updates) {
      lines.push(formatCheck(c, color));
    }
    lines.push("");
  }
  if (report.wiki.length > 0) {
    lines.push(color ? `${BOLD}## Current wiki${RST}` : "## Current wiki");
    for (const c of report.wiki) {
      lines.push(formatCheck(c, color));
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
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

function formatCheck(c: Check, color: boolean): string {
  const { icon, tint } = iconFor(c.status, color);
  const head = `  ${tint}${icon}${color ? RST : ""} ${c.message}`;
  if (c.fix === undefined) return head;
  const fixLine = color
    ? `    ${DIM}${c.fix}${RST}`
    : `    ${c.fix}`;
  return `${head}\n${fixLine}`;
}

function iconFor(
  status: CheckStatus,
  color: boolean,
): { icon: string; tint: string } {
  switch (status) {
    case "ok":
      return { icon: "\u2713", tint: color ? GREEN : "" };
    case "problem":
      return { icon: "\u2717", tint: color ? RED : "" };
    case "info":
      return { icon: "\u25c7", tint: color ? BLUE : "" };
  }
}

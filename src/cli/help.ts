import { Command, type Help } from "commander";

import { BLUE, BOLD, DIM, RST } from "../ansi.js";

const HELP_GROUPS: Array<{ title: string; commands: string[] }> = [
  {
    title: "Query",
    commands: ["search", "show", "health", "list"],
  },
  {
    title: "Edit",
    commands: ["tag", "untag", "topics"],
  },
  {
    title: "Wiki lifecycle",
    commands: ["init", "capture", "ingest", "garden", "jobs", "hook", "reindex"],
  },
  {
    title: "Setup",
    commands: ["agents", "config", "setup", "uninstall", "doctor", "update"],
  },
  {
    title: "Deprecated",
    commands: ["set", "ps"],
  },
];

/**
 * Install a custom `formatHelp` that replaces commander's flat
 * "Commands:" section with grouped headings. Keeps usage + options +
 * per-command short descriptions; only the commands section changes.
 */
export function configureGroupedHelp(program: Command): void {
  program.configureHelp({
    formatHelp(cmd, helper): string {
      if (cmd.parent !== null) {
        return renderDefault(cmd, helper);
      }

      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth =
        helper.helpWidth ?? process.stdout.columns ?? 80;
      const itemSepWidth = 2;

      const out: string[] = [];
      out.push(`${BOLD}Usage:${RST} ${helper.commandUsage(cmd)}\n`);

      const description = helper.commandDescription(cmd);
      if (description.length > 0) {
        out.push(
          helper.wrap(description, helpWidth, 0) + "\n",
        );
      }

      const optionList = helper
        .visibleOptions(cmd)
        .map((o) => {
          const term = helper.optionTerm(o);
          const pad = " ".repeat(Math.max(0, termWidth - term.length) + itemSepWidth);
          return `${BLUE}${term}${RST}${pad}${DIM}${helper.optionDescription(o)}${RST}`;
        });
      if (optionList.length > 0) {
        out.push(`${BOLD}Options:${RST}`);
        for (const l of optionList) out.push(`  ${l}`);
        out.push("");
      }

      const visible = helper.visibleCommands(cmd);
      const byName = new Map<string, (typeof visible)[number]>();
      for (const c of visible) byName.set(c.name(), c);

      for (const group of HELP_GROUPS) {
        const members = group.commands
          .map((n) => byName.get(n))
          .filter((c): c is (typeof visible)[number] => c !== undefined);
        if (members.length === 0) continue;
        out.push(`${BOLD}${group.title}:${RST}`);
        for (const c of members) {
          const term = helper.subcommandTerm(c);
          const desc = helper.subcommandDescription(c);
          const padding = Math.max(
            0,
            termWidth - term.length + itemSepWidth,
          );
          out.push(`  ${BLUE}${term}${RST}${" ".repeat(padding)}${DIM}${desc}${RST}`);
          byName.delete(c.name());
        }
        out.push("");
      }

      byName.delete("help");
      if (byName.size > 0) {
        out.push(`${BOLD}Other:${RST}`);
        for (const c of byName.values()) {
          const term = helper.subcommandTerm(c);
          const desc = helper.subcommandDescription(c);
          const padding = Math.max(
            0,
            termWidth - term.length + itemSepWidth,
          );
          out.push(`  ${BLUE}${term}${RST}${" ".repeat(padding)}${DIM}${desc}${RST}`);
        }
        out.push("");
      }

      return out.join("\n");
    },
  });
}

function renderDefault(cmd: Command, helper: Help): string {
  const termWidth = helper.padWidth(cmd, helper);
  const helpWidth = helper.helpWidth ?? process.stdout.columns ?? 80;
  const itemSepWidth = 2;

  const lines: string[] = [`${BOLD}Usage:${RST} ${helper.commandUsage(cmd)}\n`];
  const description = helper.commandDescription(cmd);
  if (description.length > 0) {
    lines.push(helper.wrap(description, helpWidth, 0) + "\n");
  }

  const args = helper.visibleArguments(cmd).map((a) => {
    const term = helper.argumentTerm(a);
    const pad = " ".repeat(Math.max(0, termWidth - term.length) + itemSepWidth);
    return `${BLUE}${term}${RST}${pad}${DIM}${helper.argumentDescription(a)}${RST}`;
  });
  if (args.length > 0) {
    lines.push(`${BOLD}Arguments:${RST}`);
    for (const a of args) lines.push(`  ${a}`);
    lines.push("");
  }

  const opts = helper.visibleOptions(cmd).map((o) => {
    const term = helper.optionTerm(o);
    const pad = " ".repeat(Math.max(0, termWidth - term.length) + itemSepWidth);
    return `${BLUE}${term}${RST}${pad}${DIM}${helper.optionDescription(o)}${RST}`;
  });
  if (opts.length > 0) {
    lines.push(`${BOLD}Options:${RST}`);
    for (const o of opts) lines.push(`  ${o}`);
    lines.push("");
  }

  const subs = helper.visibleCommands(cmd).map((c) => {
    const term = helper.subcommandTerm(c);
    const pad = " ".repeat(Math.max(0, termWidth - term.length) + itemSepWidth);
    return `${BLUE}${term}${RST}${pad}${DIM}${helper.subcommandDescription(c)}${RST}`;
  });
  if (subs.length > 0) {
    lines.push(`${BOLD}Commands:${RST}`);
    for (const s of subs) lines.push(`  ${s}`);
    lines.push("");
  }

  return lines.join("\n");
}

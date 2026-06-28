export type SetupInstructionTargetId =
  | "claude"
  | "codex"
  | "cursor"
  | "windsurf"
  | "opencode";

export interface SetupInstructionTarget {
  id: SetupInstructionTargetId;
  displayName: string;
}

export interface SetupInstructionsChange {
  anyChanges: boolean;
  filesTouched: string[];
}

export interface SetupInstructionDirs {
  claudeDir: string;
  codexDir: string;
  cursorDir: string;
  windsurfDir: string;
  opencodeDir: string;
}

export interface SetupInstructionInstallRequest {
  targets: readonly SetupInstructionTargetId[];
  homeDir: string;
  guidesDir: string;
  claudeDir?: string;
  codexDir?: string;
  cursorDir?: string;
  windsurfDir?: string;
  opencodeDir?: string;
}

export interface SetupInstructionRuntime {
  install(request: SetupInstructionInstallRequest): Promise<SetupInstructionsChange>;
  remove(dirs: SetupInstructionDirs): Promise<SetupInstructionsChange>;
}

export const SETUP_IMPORT_LINE = "@~/.claude/almanac.md";
export const LEGACY_SETUP_IMPORT_LINE = "@~/.claude/codealmanac.md";

export const CODEX_INSTRUCTIONS_START = "<!-- almanac:start -->";
export const CODEX_INSTRUCTIONS_END = "<!-- almanac:end -->";
export const LEGACY_CODEX_INSTRUCTIONS_START = "<!-- codealmanac:start -->";
export const LEGACY_CODEX_INSTRUCTIONS_END = "<!-- codealmanac:end -->";

export const SETUP_INSTRUCTION_TARGETS: readonly SetupInstructionTarget[] = [
  { id: "claude", displayName: "Claude Code" },
  { id: "codex", displayName: "Codex" },
  { id: "cursor", displayName: "Cursor" },
  { id: "windsurf", displayName: "Windsurf" },
  { id: "opencode", displayName: "OpenCode" },
];

export const DEFAULT_SETUP_INSTRUCTION_TARGETS:
  readonly SetupInstructionTargetId[] = SETUP_INSTRUCTION_TARGETS.map(
    (target) => target.id,
  );

export function hasSetupImportLine(contents: string): boolean {
  const lines = contents.split(/\r?\n/).map((line) => line.trim());
  return lines.some((line) => isImportLineFor(line, SETUP_IMPORT_LINE));
}

export function removeSetupImportLine(contents: string): {
  changed: boolean;
  body: string;
} {
  const eol = contents.includes("\r\n") ? "\r\n" : "\n";
  const lines = contents.split(/\r?\n/);
  const indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (
      isImportLineFor(line, SETUP_IMPORT_LINE) ||
      isImportLineFor(line, LEGACY_SETUP_IMPORT_LINE)
    ) {
      indices.push(i);
    }
  }
  if (indices.length === 0) return { changed: false, body: contents };

  for (let i = indices.length - 1; i >= 0; i--) {
    lines.splice(indices[i]!, 1);
  }

  return {
    changed: true,
    body: lines.join(eol).replace(/\n\n\n+/g, "\n\n"),
  };
}

export function hasCodexInstructions(contents: string): boolean {
  return (
    contents.includes(CODEX_INSTRUCTIONS_START) &&
    contents.includes(CODEX_INSTRUCTIONS_END)
  );
}

export function upsertManagedBlock(
  contents: string,
  start: string,
  end: string,
  block: string,
): string {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end);
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const afterEnd = endIndex + end.length;
    return `${contents.slice(0, startIndex)}${block}${contents.slice(afterEnd)}`;
  }

  const sep =
    contents.length === 0 ? "" : contents.endsWith("\n") ? "\n" : "\n\n";
  return `${contents}${sep}${block}\n`;
}

export function removeManagedBlock(
  contents: string,
  start: string,
  end: string,
): { changed: boolean; body: string } {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return { changed: false, body: contents };
  }

  const afterEnd = endIndex + end.length;
  let body = `${contents.slice(0, startIndex)}${contents.slice(afterEnd)}`;
  body = body.replace(/\n\n\n+/g, "\n\n");
  body = body.replace(/^\n+/, "");
  return { changed: true, body };
}

function isImportLineFor(line: string, importLine: string): boolean {
  if (line === importLine) return true;
  const rest = line.slice(importLine.length);
  return line.startsWith(importLine) && /^[\t ]/.test(rest);
}

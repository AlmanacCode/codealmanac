export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function emit(result: CommandResult): void {
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.exitCode !== 0) process.exitCode = result.exitCode;
}

export function withWarning(
  result: CommandResult,
  warning: string,
): CommandResult {
  return {
    ...result,
    stderr: `${warning}${result.stderr}`,
  };
}

export function deprecationWarning(oldUsage: string, newUsage: string): string {
  return `almanac: warning: \`${oldUsage}\` is deprecated; use \`${newUsage}\`.\n`;
}

export function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function parsePositiveInt(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`invalid --limit "${value}" (expected a non-negative integer)`);
  }
  return n;
}

export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY === true) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

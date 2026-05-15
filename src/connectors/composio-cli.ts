import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ComposioCliOptions {
  bin?: string;
  run?: (args: string[]) => Promise<unknown>;
}

export class ComposioCli {
  constructor(private readonly options: ComposioCliOptions = {}) {}

  static defaultBin(): string | null {
    const local = join(homedir(), ".composio", "composio");
    return existsSync(local) ? local : "composio";
  }

  async whoami(): Promise<Record<string, unknown>> {
    return expectRecord(await this.run(["whoami"]));
  }

  async searchNotion(): Promise<Record<string, unknown>> {
    return expectRecord(await this.run([
      "search",
      "fetch notion pages",
      "--toolkits",
      "notion",
      "--limit",
      "1",
    ]));
  }

  async execute(slug: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return expectRecord(await this.run([
      "execute",
      slug,
      "-d",
      JSON.stringify(data),
    ]));
  }

  private async run(args: string[]): Promise<unknown> {
    if (this.options.run !== undefined) return this.options.run(args);
    const bin = this.options.bin ?? ComposioCli.defaultBin();
    if (bin === null) {
      throw new Error("Composio CLI is not installed. Run: curl -fsSL https://composio.dev/install | bash");
    }
    let stdout = "";
    let stderr = "";
    try {
      const result = await execFileAsync(bin, args, {
        maxBuffer: 20 * 1024 * 1024,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err: unknown) {
      if (err !== null && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        throw new Error("Composio CLI is not installed. Run: curl -fsSL https://composio.dev/install | bash");
      }
      throw err;
    }
    return await resolveStoredOutput(parseCliJson(`${stdout}\n${stderr}`));
  }
}

export function parseCliJson(output: string): unknown {
  const candidates = [output.indexOf("{"), output.indexOf("[")]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  for (const index of candidates) {
    const jsonText = extractBalancedJson(output, index);
    if (jsonText === null) continue;
    try {
      return JSON.parse(jsonText) as unknown;
    } catch {
      // Try the next JSON-looking segment.
    }
  }
  throw new Error("Composio CLI did not return JSON");
}

function extractBalancedJson(output: string, start: number): string | null {
  const opener = output[start];
  const closer = opener === "{" ? "}" : opener === "[" ? "]" : null;
  if (closer === null) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < output.length; index += 1) {
    const char = output[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === opener) depth += 1;
    if (char === closer) {
      depth -= 1;
      if (depth === 0) return output.slice(start, index + 1);
    }
  }
  return null;
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Composio CLI returned an unexpected response shape");
  }
  return value as Record<string, unknown>;
}

async function resolveStoredOutput(value: unknown): Promise<unknown> {
  const record = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (
    record?.storedInFile === true &&
    typeof record.outputFilePath === "string" &&
    record.outputFilePath.length > 0
  ) {
    return parseCliJson(await readFile(record.outputFilePath, "utf8"));
  }
  return value;
}

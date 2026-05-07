import { createWriteStream, existsSync, type WriteStream } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import type { SpawnCliFn } from "../agent/auth.js";
import { assertAgentAuth } from "../agent/providers.js";
import { loadPrompt } from "../agent/prompts.js";
import {
  runAgent,
  type AgentResult,
  type AgentStreamMessage,
  type RunAgentOptions,
} from "../agent/sdk.js";
import { findNearestAlmanacDir, getRepoAlmanacDir } from "../paths.js";
import {
  isAgentProviderId,
  readConfig,
  type AgentProviderId,
} from "../update/config.js";
import { initWiki } from "./init.js";

export interface BootstrapOptions {
  cwd: string;
  /** Suppress per-tool-use streaming output; print only errors + final line. */
  quiet?: boolean;
  /** Override the agent model. Defaults to the SDK default (sonnet-4-6). */
  model?: string;
  /** Override the agent provider. Defaults to ~/.almanac/config.json. */
  agent?: string;
  /** Overwrite a populated wiki. Default refuses with a pointer at `capture`. */
  force?: boolean;
  /** Injectable agent runner — tests replace this with a fake. */
  runAgent?: (opts: RunAgentOptions) => Promise<AgentResult>;
  /**
   * Injectable subprocess spawner for the Claude auth-status check.
   * Tests substitute a stub that emits canned JSON without running the
   * bundled CLI. Production leaves this undefined and `assertClaudeAuth`
   * falls through to `defaultSpawnCli`.
   */
  spawnCli?: SpawnCliFn;
  /**
   * Clock injection, for tests. Otherwise `Date.now()` timestamps the
   * transcript log filename and defaults to the SDK's session_id once
   * we receive one (the filename is chosen BEFORE the agent starts so
   * we can stream to it).
   */
  now?: () => Date;
}

export interface BootstrapResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Tools the bootstrap agent is permitted to use. Bootstrap reads the repo
 * (Read/Glob/Grep), runs quick inspection commands (Bash — scoped by the
 * prompt, not by the SDK — the agent isn't expected to do anything
 * destructive), and writes scaffolding (Write/Edit). Notably absent:
 *   - `Agent` — bootstrap has no subagents (reviewer is slice 5).
 *   - `WebFetch` / `WebSearch` — prompt is explicit that we work from the
 *     repo, not the internet. Adding these would invite drift.
 *   - MCP servers — none needed for a local filesystem scan.
 */
const BOOTSTRAP_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];

/**
 * `almanac bootstrap` — first Claude Agent SDK integration.
 *
 * Flow:
 *   1. Auth gate (ANTHROPIC_API_KEY). Fail fast with a clean error.
 *   2. Resolve repo root (existing `.almanac/` or cwd).
 *   3. Refuse-if-populated unless --force.
 *   4. Auto-init silently if `.almanac/` doesn't exist yet.
 *   5. Load `prompts/bootstrap.md`.
 *   6. Run the agent with BOOTSTRAP_TOOLS, cwd = repo root.
 *   7. Stream tool-uses to stdout (unless --quiet); write the full raw
 *      transcript to `.almanac/logs/.bootstrap-<session>.log`.
 *   8. Print a final `[done]` / `[failed]` line with cost + turns.
 *
 * Non-zero exit on failure so shell users can pipe into `&&`.
 */
export async function runBootstrap(
  options: BootstrapOptions,
): Promise<BootstrapResult> {
  // Fail before loading prompts so we don't do filesystem work on a request
  // that can't succeed. `assertClaudeAuth` accepts either subscription
  // OAuth (via the bundled SDK CLI) or `ANTHROPIC_API_KEY`; missing both
  // surfaces a two-option error and MUST exit non-zero so the SessionEnd
  // hook (which backgrounds the process and ignores stderr) doesn't
  // treat silent auth failure as success.
  const providerResolution = await resolveAgentSelection({
    agent: options.agent,
    model: options.model,
  });
  if (!providerResolution.ok) {
    return {
      stdout: "",
      stderr: `almanac: ${providerResolution.error}\n`,
      exitCode: 1,
    };
  }
  const { provider, model } = providerResolution;

  try {
    await assertAgentAuth({ provider, spawnCli: options.spawnCli });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      stdout: "",
      stderr: `almanac: ${msg}\n`,
      exitCode: 1,
    };
  }

  // Repo root: honor an already-initialized wiki anywhere above us.
  // Otherwise treat `cwd` as the root for a fresh wiki.
  const repoRoot = findNearestAlmanacDir(options.cwd) ?? options.cwd;
  const almanacDir = getRepoAlmanacDir(repoRoot);
  const pagesDir = join(almanacDir, "pages");

  // Refuse to clobber a populated wiki. `almanac capture` is the tool for
  // maintaining wikis after bootstrap.
  if (options.force !== true && existsSync(pagesDir)) {
    const existing = await countMarkdownPages(pagesDir);
    if (existing > 0) {
      return {
        stdout: "",
        stderr:
          `almanac: .almanac/ already initialized with ${existing} page${existing === 1 ? "" : "s"}. ` +
          "Use 'almanac capture' instead, or --force to overwrite.\n",
        exitCode: 1,
      };
    }
  }

  // Auto-init silently if missing. `initWiki` is idempotent — re-running
  // on an existing wiki is a no-op for the README / pages dir.
  if (!existsSync(almanacDir)) {
    try {
      await initWiki({ cwd: repoRoot });
    } catch (err: unknown) {
      // Per the slice spec: auto-init failures should be loud. The user
      // needs to know init is broken, not see a cascading agent error.
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `almanac: init failed during bootstrap: ${msg}\n`,
        exitCode: 1,
      };
    }
  }

  const systemPrompt = await loadPrompt("bootstrap");

  // Transcript log filename: timestamp-based so it's sortable. The session
  // ID from the SDK isn't known until the first message arrives — by then
  // we'd already want somewhere to stream to. Use a clock-derived prefix
  // that's still meaningful even on a run that fails before producing a
  // session_id.
  const now = options.now?.() ?? new Date();
  const logsDir = join(almanacDir, "logs");
  await mkdir(logsDir, { recursive: true });
  const logName = `.bootstrap-${formatTimestamp(now)}.log`;
  const logPath = join(logsDir, logName);
  const logStream = createWriteStream(logPath, { flags: "w" });

  // The streaming formatter is what the user sees on stdout unless
  // --quiet is set. The raw log captures EVERYTHING (including
  // `stream_event` partials) for postmortem.
  const out = process.stdout;
  const formatter = new StreamingFormatter({
    write: (line: string) => {
      if (options.quiet !== true) out.write(line);
    },
  });

  const onMessage = (msg: AgentStreamMessage): void => {
    // Write the raw message to the transcript. Keep one JSON per line so
    // the log is grep-able and can be re-parsed if needed.
    try {
      logStream.write(`${JSON.stringify(msg)}\n`);
    } catch {
      // Serialization failures are non-fatal — we'd rather keep streaming
      // to stdout than crash because one message had a circular ref.
    }
    formatter.handle(msg);
  };

  const runner = options.runAgent ?? runAgent;

  const userPrompt = `Begin the bootstrap now. Working directory: ${repoRoot}.`;

  let result: AgentResult;
  try {
    result = await runner({
      systemPrompt,
      prompt: userPrompt,
      allowedTools: BOOTSTRAP_TOOLS,
      cwd: repoRoot,
      provider,
      model,
      onMessage,
    });
  } finally {
    await closeStream(logStream);
  }

  const finalLine = formatFinalLine(result, logPath, repoRoot);

  if (result.success) {
    return {
      stdout: `${finalLine}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  return {
    stdout: options.quiet === true ? "" : `${finalLine}\n`,
    stderr: `almanac: bootstrap failed: ${result.error ?? "unknown error"}\n`,
    exitCode: 1,
  };
}

type AgentSelection =
  | { ok: true; provider: AgentProviderId; model?: string }
  | { ok: false; error: string };

async function resolveAgentSelection(args: {
  agent?: string;
  model?: string;
}): Promise<AgentSelection> {
  const config = await readConfig();
  const rawProvider = args.agent ?? config.agent.default;
  if (!isAgentProviderId(rawProvider)) {
    return {
      ok: false,
      error:
        `unknown agent '${rawProvider}'. Expected one of: claude, codex, cursor.`,
    };
  }
  const configuredModel = config.agent.models[rawProvider] ?? undefined;
  const model =
    args.model !== undefined
      ? args.model
      : configuredModel === null
        ? undefined
        : configuredModel;
  return { ok: true, provider: rawProvider, model };
}

/**
 * Format the final line the user sees. On success it's a one-liner with
 * cost + turns; on failure we still print the cost/turns so the user
 * knows what the partial run used. The log path is shown relative to
 * `repoRoot` to keep the line short.
 */
function formatFinalLine(
  result: AgentResult,
  logPath: string,
  repoRoot: string,
): string {
  const status = result.success ? "done" : "failed";
  const rel = relative(repoRoot, logPath);
  const cost = `$${result.cost.toFixed(3)}`;
  return `[${status}] cost: ${cost}, turns: ${result.turns} (transcript: ${rel})`;
}

async function countMarkdownPages(pagesDir: string): Promise<number> {
  try {
    const entries = await readdir(pagesDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

function closeStream(stream: WriteStream): Promise<void> {
  return new Promise((resolve) => {
    stream.end(() => resolve());
  });
}

function formatTimestamp(d: Date): string {
  // YYYYMMDD-HHMMSS, local time. Collision-proof enough for human use
  // (one bootstrap per second, per repo is an acceptable ceiling).
  const pad = (n: number): string => n.toString().padStart(2, "0");
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const da = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}${mo}${da}-${h}${mi}${s}`;
}

/**
 * Translates SDK messages into one-line-per-tool-use output.
 *
 * Design rules:
 *   - One line per `tool_use` block, not per token. Users scanning the
 *     output want to see "what the agent did", not a tail of the
 *     assistant's prose.
 *   - `Bash` gets special formatting because the input is most usefully
 *     rendered as the command being run.
 *   - On final `result`, emit a summary line. Callers can suppress all
 *     intermediate output via `--quiet` and still get the summary.
 *   - Tool paths are shown relative to the cwd (not implemented here
 *     because the SDK doesn't give us cwd on every message; users get
 *     the raw input). The cwd-relative rendering is a nice-to-have that
 *     we can layer on later without changing the API.
 *
 * Exported for testing — `StreamingFormatter` is easier to unit-test in
 * isolation than the whole command.
 */
export class StreamingFormatter {
  private readonly sink: { write: (line: string) => void };
  /**
   * Current agent label. Starts as "bootstrap"; switches when we see an
   * `Agent` tool-use (slice 5 will exercise this). We still track it here
   * so the formatter can stay shared between bootstrap and capture.
   */
  private currentAgent = "bootstrap";

  constructor(sink: { write: (line: string) => void }) {
    this.sink = sink;
  }

  /**
   * Swap the top-level agent label. `capture` uses this to relabel from
   * the default "bootstrap" to "writer" — otherwise the writer's tool-use
   * output would render as `[bootstrap] …`, which is confusing when you're
   * reading capture logs.
   */
  setAgent(name: string): void {
    this.currentAgent = name;
  }

  handle(msg: AgentStreamMessage): void {
    if (!isRecord(msg)) return;

    if (msg.type === "assistant" && isRecord(msg.message)) {
      const content = msg.message.content;
      if (!Array.isArray(content)) return;
      for (const block of msg.message.content) {
        if (!isRecord(block) || block.type !== "tool_use") continue;
        if (typeof block.name !== "string") continue;
        this.handleToolUse(block.name, block.input);
      }
      return;
    }

    if (msg.type === "result") {
      // The command-level finalLine is what the user sees at the end of
      // stdout; the formatter also emits one here so live-tailing a
      // transcript log shows the full run. Kept terse.
      const status =
        msg.subtype === "success" ? "done" : `failed (${msg.subtype})`;
      const cost =
        typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : 0;
      const turns = typeof msg.num_turns === "number" ? msg.num_turns : 0;
      this.sink.write(
        `[${status}] cost: $${cost.toFixed(3)}, turns: ${turns}\n`,
      );
      return;
    }
  }

  private handleToolUse(name: string, rawInput: unknown): void {
    const input = normalizeToolInput(rawInput);

    if (name === "Agent") {
      // Subagent dispatch. Track the label so subsequent tool-uses show
      // up under the right agent bracket. The label is whatever the
      // parent passed as `subagent_type`, falling back to "subagent" if
      // the input was malformed (shouldn't happen, but defensively).
      const sub =
        typeof input.subagent_type === "string" ? input.subagent_type : "subagent";
      this.currentAgent = sub;
      this.sink.write(`[${sub}] starting\n`);
      return;
    }

    const summary = formatToolSummary(name, input);
    this.sink.write(`[${this.currentAgent}] ${summary}\n`);
  }
}

/**
 * SDK quirk: `tool_use.input` arrives as either an object OR a
 * JSON-encoded string. Always normalize before touching fields.
 */
function normalizeToolInput(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to empty object.
    }
    return {};
  }
  if (raw !== null && typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Render a tool call as a single human-readable line. Not exhaustive —
 * we cover the tools bootstrap actually invokes and fall back to the
 * tool name + a terse input summary for anything else.
 */
function formatToolSummary(
  name: string,
  input: Record<string, unknown>,
): string {
  switch (name) {
    case "Read": {
      const target = stringField(input, "file_path") ?? "?";
      return `reading ${target}`;
    }
    case "Write": {
      const target = stringField(input, "file_path") ?? "?";
      return `writing ${target}`;
    }
    case "Edit": {
      const target = stringField(input, "file_path") ?? "?";
      return `editing ${target}`;
    }
    case "Glob": {
      const pattern = stringField(input, "pattern") ?? "?";
      return `glob ${pattern}`;
    }
    case "Grep": {
      const pattern = stringField(input, "pattern") ?? "?";
      return `grep ${pattern}`;
    }
    case "Bash": {
      const command = stringField(input, "command") ?? "?";
      // Truncate long commands so one tool-use stays one line.
      const trimmed =
        command.length > 80 ? `${command.slice(0, 77)}...` : command;
      return `bash ${trimmed}`;
    }
    default: {
      // Unknown or MCP tool. Show the name; omit the input to avoid
      // spamming the terminal with arbitrary JSON.
      return name;
    }
  }
}

function stringField(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

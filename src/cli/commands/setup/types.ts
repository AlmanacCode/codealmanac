import type {
  SetupInstructionTargetId,
  SetupSpawnCliFn,
} from "../../../services/setup/index.js";

export type AutomationExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

export interface SetupOptions {
  /** Install everything without prompting. */
  yes?: boolean;
  /** Don't install the scheduled sync job. */
  skipAutomation?: boolean;
  /** Configure the scheduled sync interval. Defaults to 5h. */
  automationEvery?: string;
  /** Configure the scheduled sync quiet window. Defaults to 45m. */
  automationQuiet?: string;
  /** Configure the scheduled Garden interval. Defaults to 4h. */
  gardenEvery?: string;
  /** Don't install the scheduled Garden job. */
  gardenOff?: boolean;
  /** Install scheduled Almanac self-update. */
  autoUpdate?: boolean;
  /** Configure the scheduled self-update interval. Defaults to 1d. */
  autoUpdateEvery?: string;
  /** Don't install the CLAUDE.md guides. */
  skipGuides?: boolean;
  /** Allow lifecycle runs to commit wiki source changes automatically. */
  autoCommit?: boolean;
  /** Set the default agent provider during setup. */
  agent?: string;
  /** Set the default model for the selected provider during setup. */
  model?: string;

  /** Current working directory used for repo-local setup state. */
  cwd: string;
  /** PATH value inherited by launchd jobs during setup. */
  pathEnvironment: string | undefined;
  /** Base CLI command used by scheduled launchd jobs. */
  cliProgramArguments: string[];
  /** Override the subprocess spawner for provider login checks. */
  spawnCli?: SetupSpawnCliFn;
  /** Override the launchd plist path. */
  automationPlistPath?: string;
  /** Override the Garden launchd plist path. */
  gardenPlistPath?: string;
  /** Override the update launchd plist path. */
  updatePlistPath?: string;
  /** Override launchctl execution. */
  automationExec?: AutomationExecFn;
  /** Override `~/.claude/` dir for guide install. */
  claudeDir?: string;
  /** Override `~/.codex/` dir for Codex instruction install. */
  codexDir?: string;
  /** Override `~/.cursor/` dir for Cursor instruction install. */
  cursorDir?: string;
  /** Override `~/.codeium/windsurf/` dir for Windsurf instruction install. */
  windsurfDir?: string;
  /** Override `~/.config/opencode/` dir for OpenCode instruction install. */
  opencodeDir?: string;
  /** Override selected global instruction targets. */
  instructionTargets?: SetupInstructionTargetId[];
  /** Override the directory containing `mini.md` / `reference.md`. */
  guidesDir?: string;
  /** Override interactivity; defaults to `process.stdin.isTTY`. */
  isTTY?: boolean;
  /** Stdout sink; defaults to `process.stdout`. */
  stdout?: NodeJS.WritableStream;
  /** Render setup terminal UI with ANSI color. */
  color?: boolean;
  /** Override the install-path probe result; `null` bypasses the probe. */
  installPath?: string | null;
  /** Override the npm global install spawner. */
  spawnGlobalInstall?: () => Promise<void>;
}

export interface SetupResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

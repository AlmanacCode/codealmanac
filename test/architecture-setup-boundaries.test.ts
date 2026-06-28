import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries: setup and uninstall", () => {
  it("keeps setup agent choice UI out of readiness and config mechanics", async () => {
    const setupServiceIndex = await readSource("src/services/setup/index.ts");
    const setupServiceAgentChoice = await readSource(
      "src/services/setup/agent-choice.ts",
    );
    const setupAgentChoiceTypes = await readSource(
      "src/services/setup/agent-choice-types.ts",
    );
    const setupAgentChoiceView = await readSource(
      "src/services/setup/agent-choice-view.ts",
    );
    const setupAgentSelection = await readSource(
      "src/services/setup/agent-selection.ts",
    );
    const setupAgentChoice = await readSource(
      "src/edges/cli/setup/agent-choice.ts",
    );
    const setupAgentProviderChoice = await readSource(
      "src/edges/cli/setup/agent-provider-choice.ts",
    );
    const setupAgentProviderDisplay = await readSource(
      "src/edges/cli/setup/agent-provider-display.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/agent-choice.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/setup/agent-choice-types.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/services/setup/agent-choice-view.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/services/setup/agent-selection.ts")))
      .toBe(true);
    expect(setupServiceIndex).not.toContain("../../agent/");
    expect(setupServiceIndex).not.toContain("../../config/");
    expect(setupServiceIndex).toContain("agent-choice-types.js");
    expect(setupServiceIndex).toContain("agent-selection.js");
    expect(setupServiceAgentChoice).not.toContain("SetupSpawnCliFn = SpawnCliFn");
    expect(setupServiceAgentChoice).not.toContain(
      "SetupProviderView = ProviderSetupView",
    );
    expect(setupServiceAgentChoice).not.toContain(
      "SetupProviderModelChoice = ProviderModelChoice",
    );
    expect(setupServiceAgentChoice).not.toContain(
      "SetupAgentProviderId = AgentProviderId",
    );
    expect(setupServiceAgentChoice).not.toContain(
      "SetupConfiguredModels = Partial",
    );
    expect(setupServiceAgentChoice).not.toContain("parseAgentSelection");
    expect(setupServiceAgentChoice).not.toContain("ProviderSetupChoice");
    expect(setupServiceAgentChoice).not.toContain("interface SetupProviderView");
    expect(setupAgentChoiceTypes).toContain("AgentReadinessSpawnCliFn");
    expect(setupAgentChoiceTypes).not.toContain("interface SetupSpawnedProcess");
    expect(setupAgentChoiceTypes).not.toContain("stdout: { on:");
    expect(setupAgentChoiceTypes).not.toContain("stderr: { on:");
    expect(setupAgentChoiceTypes).toContain("interface SetupProviderView");
    expect(setupAgentChoiceView).toContain(
      "setupConfiguredModelsFromConfig",
    );
    expect(setupAgentChoiceView).toContain(
      "setupProviderViewFromReadinessView",
    );
    expect(setupAgentSelection).toContain("parseAgentSelection");
    expect(setupAgentSelection).toContain("isEnabledAgentProviderId");
    expect(setupAgentChoice).toContain("services/setup/index.js");
    expect(setupAgentProviderChoice).toContain("services/setup/index.js");
    expect(setupAgentProviderDisplay).toContain("services/setup/index.js");
    expect(setupAgentChoice).not.toContain("../../../agent");
    expect(setupAgentProviderChoice).not.toContain("../../../agent");
    expect(setupAgentChoice).not.toContain("agent/readiness/view");
    expect(setupAgentProviderChoice).not.toContain("agent/readiness/view");
    expect(setupAgentChoice).not.toContain("../../../config/index");
    expect(setupAgentProviderChoice).not.toContain("../../../config/index");
    expect(setupAgentChoice).not.toContain("readConfig");
    expect(setupAgentProviderChoice).not.toContain("readConfig");
    expect(setupAgentChoice).not.toContain("writeConfig");
    expect(setupAgentProviderChoice).not.toContain("writeConfig");
    expect(setupAgentChoice).not.toContain("config.agent");
    expect(setupAgentProviderChoice).not.toContain("config.agent");
    expect(setupAgentChoice).not.toContain("parseAgentSelection");
    expect(setupAgentProviderChoice).not.toContain("parseAgentSelection");
    expect(setupAgentChoice).not.toContain("isAgentProviderId");
    expect(setupAgentProviderChoice).not.toContain("isAgentProviderId");
  });

  it("keeps setup input controls out of display rendering", async () => {
    const setupOutput = await readSource("src/edges/cli/setup/output.ts");
    const linePrompt = await readSource("src/edges/cli/setup/line-prompt.ts");
    const selectChoice = await readSource("src/edges/cli/setup/select-choice.ts");
    const multiSelect = await readSource("src/edges/cli/setup/multi-select.ts");
    const rawInput = await readSource("src/edges/cli/setup/raw-input.ts");
    const setupInterruption = await readSource(
      "src/edges/cli/setup/setup-interruption.ts",
    );
    const setupIndex = await readSource("src/edges/cli/setup/index.ts");
    const setupFlow = await readSource("src/edges/cli/setup/setup-flow.ts");
    const setupNextSteps = await readSource(
      "src/edges/cli/setup/next-steps.ts",
    );
    const setupAutomationStep = await readSource(
      "src/edges/cli/setup/automation-step.ts",
    );
    const setupAutoUpdateStep = await readSource(
      "src/edges/cli/setup/auto-update-step.ts",
    );
    const setupServiceIndex = await readSource("src/services/setup/index.ts");
    const setupServicePlan = await readSource("src/services/setup/setup-plan.ts");
    const setupEdgePlan = await readSource("src/edges/cli/setup/setup-plan.ts");
    const setupWikiState = await readSource("src/services/wiki/setup-state.ts");
    const setupTypes = await readSource("src/edges/cli/setup/types.ts");
    const setupRegistration = await readSource(
      "src/edges/cli/register-setup-command.ts",
    );
    const sqliteFree = await readSource("src/edges/cli/sqlite-free.ts");
    const currentCli = await readSource("src/edges/cli/current-cli.ts");
    const setupCallers = await Promise.all([
      readSource("src/edges/cli/setup/agent-model-choice.ts"),
      readSource("src/edges/cli/setup/agent-choice.ts"),
      readSource("src/edges/cli/setup/agent-provider-choice.ts"),
      readSource("src/edges/cli/setup/agent-provider-display.ts"),
      readSource("src/edges/cli/setup/global-install-step.ts"),
      readSource("src/edges/cli/setup/index.ts"),
      readSource("src/edges/cli/setup/instruction-target-choice.ts"),
      readSource("src/edges/cli/setup/setup-flow.ts"),
      readSource("src/edges/cli/setup/setup-plan.ts"),
    ]);

    expect(existsSync(join(ROOT, "src/edges/cli/commands/setup"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/setup"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/input.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/line-prompt.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/select-choice.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/raw-input.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/setup-interruption.ts"))).toBe(true);
    expect(linePrompt).toContain("export function confirm");
    expect(linePrompt).toContain("export function promptText");
    expect(linePrompt).toContain("export async function waitForEnter");
    expect(linePrompt).toContain("SetupInputStream");
    expect(linePrompt).toContain("theme: SetupTheme");
    expect(linePrompt).not.toContain("setRawMode");
    expect(linePrompt).not.toContain("SetupInterruptedError");
    expect(linePrompt).not.toContain("selectChoice");
    expect(selectChoice).toContain("export async function selectChoice");
    expect(selectChoice).toContain("canUseRawInput");
    expect(selectChoice).toContain("SetupInterruptedError");
    expect(selectChoice).toContain("promptText");
    expect(selectChoice).not.toContain("export function confirm");
    expect(selectChoice).not.toContain("export function promptText");
    expect(multiSelect).toContain("export function selectManyRaw");
    expect(multiSelect).toContain("SetupInterruptedError");
    expect(multiSelect).not.toContain("export function canUseRawSelect");
    expect(rawInput).toContain("export function canUseRawInput");
    expect(rawInput).toContain("setRawMode");
    expect(rawInput).not.toContain("SetupInterruptedError");
    expect(setupInterruption).toContain("export class SetupInterruptedError");
    expect(setupInterruption).toContain("export function isSetupInterrupted");
    for (const setupInputFile of [
      linePrompt,
      selectChoice,
      multiSelect,
      rawInput,
      setupInterruption,
    ]) {
      expect(setupInputFile).not.toContain("process.stdin");
    }
    expect(setupOutput).toContain("makeSetupTheme");
    expect(setupOutput).toContain("../../../shared/ansi-theme.js");
    expect(setupOutput).not.toContain("export const RST");
    expect(setupOutput).not.toContain("export const BAR");
    expect(setupOutput).not.toContain("process.stdout.columns");
    expect(setupOutput).not.toContain("process.stdin");
    expect(setupOutput).not.toContain("setRawMode");
    expect(setupOutput).not.toContain("export function confirm");
    expect(setupOutput).not.toContain("export function promptText");
    expect(setupOutput).not.toContain("export async function selectChoice");
    expect(setupOutput).not.toContain("SetupInterruptedError");
    expect(existsSync(join(ROOT, "src/edges/cli/setup/types.ts"))).toBe(true);
    expect(setupIndex).not.toContain("interface SetupOptions");
    expect(setupIndex).not.toContain("interface SetupResult");
    expect(setupIndex).not.toContain("process.cwd()");
    expect(setupIndex).not.toContain("process.stdout");
    expect(setupIndex).not.toContain("process.stdin.isTTY");
    expect(setupIndex).toContain("makeSetupTheme(options.color !== false)");
    expect(setupIndex).toContain("setup-flow.js");
    expect(setupIndex).not.toContain("runGuidesSetupStep");
    expect(setupIndex).not.toContain("runGlobalInstallStep");
    expect(setupIndex).not.toContain("runAutoUpdateSetupStep");
    expect(setupIndex).not.toContain("chooseDefaultAgent");
    expect(setupIndex).not.toContain("runAutomationSetupStep");
    expect(setupIndex).not.toContain("runAutoCommitSetupStep");
    expect(setupFlow).toContain("buildSetupPlan");
    expect(setupFlow).toContain("runGuidesSetupStep");
    expect(setupFlow).toContain("runGlobalInstallStep");
    expect(setupFlow).toContain("runAutoUpdateSetupStep");
    expect(setupFlow).toContain("chooseDefaultAgent");
    expect(setupFlow).toContain("runAutomationSetupStep");
    expect(setupFlow).toContain("runAutoCommitSetupStep");
    expect(setupIndex).toContain("services/wiki/setup-state.js");
    expect(setupNextSteps).not.toContain("node:fs");
    expect(setupNextSteps).not.toContain("existsSync");
    expect(setupNextSteps).not.toContain("readdirSync");
    expect(setupAutomationStep).not.toContain("../automation.js");
    expect(setupAutomationStep).not.toContain("process.cwd()");
    expect(setupAutoUpdateStep).not.toContain("../automation.js");
    expect(existsSync(join(ROOT, "src/services/setup/wiki-state.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/wiki/setup-state.ts"))).toBe(true);
    expect(setupServiceIndex).not.toContain("readSetupWikiState");
    expect(setupServiceIndex).not.toContain("wiki-state");
    expect(existsSync(join(ROOT, "src/services/setup/setup-plan.ts"))).toBe(true);
    expect(setupServiceIndex).toContain("setup-plan.js");
    expect(setupServicePlan).toContain("SETUP_DEFAULTS");
    expect(setupServicePlan).toContain("resolveSetupPlan");
    expect(setupServicePlan).toContain("shouldPromptForCliAutoUpdate");
    expect(setupServicePlan).toContain("hasExplicitLocalAutomationOptions");
    expect(setupServicePlan).not.toContain("confirm(");
    expect(setupServicePlan).not.toContain("NodeJS.WritableStream");
    expect(setupServicePlan).not.toContain("stdin");
    expect(setupEdgePlan).toContain("resolveSetupPlan");
    expect(setupEdgePlan).toContain("shouldPromptForSelfManagedAutomation");
    expect(setupEdgePlan).not.toContain("const SETUP_DEFAULTS =");
    expect(setupEdgePlan).not.toContain("function hasExplicitLocalAutomationOptions");
    expect(setupWikiState).toContain("existingPageCount");
    expect(setupWikiState).toContain("countWikiPageFilesSync");
    expect(setupWikiState).not.toContain("node:fs");
    expect(setupWikiState).not.toContain("readdirSync");
    expect(setupWikiState).not.toContain("existsSync");
    expect(setupTypes).toContain("interface SetupOptions");
    expect(setupTypes).toContain("interface SetupResult");
    expect(setupTypes).toContain("stdin: SetupInputStream");
    expect(setupTypes).toContain("color?: boolean");
    expect(setupTypes).not.toContain("defaults to `process");
    expect(setupRegistration).toContain("isTTY: process.stdin.isTTY === true");
    expect(setupRegistration).toContain("stdin: process.stdin");
    expect(setupRegistration).toContain("stdout: process.stdout");
    expect(setupRegistration).toContain("color: shouldUseStdoutColor()");
    expect(setupRegistration).toContain("runPlatformSetupProviderFixCommand");
    expect(setupRegistration).toContain("runProviderFixCommand");
    expect(sqliteFree).toContain("stdin: process.stdin");
    expect(sqliteFree).toContain("color: shouldUseStdoutColor()");
    expect(currentCli).toContain("process.argv");
    expect(currentCli).toContain("process.execPath");
    for (const caller of setupCallers) {
      expect(caller).not.toContain("confirm,\n} from \"./output.js\"");
      expect(caller).not.toContain("promptText,\n} from \"./output.js\"");
      expect(caller).not.toContain("selectChoice,\n} from \"./output.js\"");
      expect(caller).not.toContain("isSetupInterrupted,\n} from \"./output.js\"");
      expect(caller).not.toContain("SetupInterruptedError,\n} from \"./output.js\"");
      expect(caller).not.toContain("./input.js");
      expect(caller).not.toContain("process.stdin");
    }
  });

  it("keeps setup global install mechanics in the platform install layer", async () => {
    const globalInstallStep = await readSource(
      "src/edges/cli/setup/global-install-step.ts",
    );
    const setupGlobalInstall = await readSource(
      "src/services/setup/global-install.ts",
    );
    const setupRuntimeContracts = await readSource(
      "src/shared/setup-runtime.ts",
    );
    const setupServiceIndex = await readSource("src/services/setup/index.ts");
    const platformSetupRuntime = await readSource("src/platform/setup/runtime.ts");
    const globalPackage = await readSource(
      "src/platform/install/global-package.ts",
    );

    expect(existsSync(join(ROOT, "src/platform/install/global-package.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/setup/runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/setup/global-install.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/setup-runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/install-path.ts"))).toBe(false);
    expect(globalInstallStep).not.toContain("platform/install/global-package.js");
    expect(globalInstallStep).toContain("platform/setup/runtime.js");
    expect(globalInstallStep).toContain("services/setup/index.js");
    expect(globalInstallStep).not.toContain("node:child_process");
    expect(globalInstallStep).not.toContain("node:module");
    expect(globalInstallStep).not.toContain("node:os");
    expect(globalInstallStep).not.toContain("fileURLToPath");
    expect(globalInstallStep).not.toContain("execFile");
    expect(globalInstallStep).not.toContain("detectCurrentInstallPath");
    expect(globalInstallStep).not.toContain("detectEphemeral");
    expect(setupGlobalInstall).not.toContain("platform/");
    expect(setupGlobalInstall).not.toContain("interface SetupGlobalInstallRuntime");
    expect(setupGlobalInstall).toContain("shared/setup-runtime.js");
    expect(setupRuntimeContracts).toContain("interface SetupGlobalInstallRuntime");
    expect(setupGlobalInstall).toContain("readSetupGlobalInstallState");
    expect(setupGlobalInstall).toContain("runSetupGlobalInstall");
    expect(setupServiceIndex).toContain("global-install.js");
    expect(platformSetupRuntime).toContain("detectCurrentInstallPath");
    expect(platformSetupRuntime).toContain("detectEphemeral");
    expect(platformSetupRuntime).toContain("spawnGlobalInstall");
    expect(globalPackage).toContain("detectCurrentInstallPath");
    expect(globalPackage).toContain("detectEphemeral");
    expect(globalPackage).toContain("spawnGlobalInstall");
  });

  it("keeps codealmanac bootstrap process spawning in a named helper", async () => {
    const bootstrap = await readSource("src/platform/install/global.ts");
    const bootstrapProcess = await readSource(
      "src/platform/install/bootstrap-process.ts",
    );
    const bootstrapPackage = await readSource(
      "src/platform/install/bootstrap-package.ts",
    );
    const bootstrapNpm = await readSource("src/platform/install/bootstrap-npm.ts");

    expect(existsSync(join(ROOT, "src/platform/install/bootstrap-process.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/platform/install/bootstrap-package.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/platform/install/bootstrap-npm.ts"))).toBe(
      true,
    );
    expect(bootstrap).toContain("bootstrap-process.js");
    expect(bootstrap).toContain("bootstrap-package.js");
    expect(bootstrap).toContain("bootstrap-npm.js");
    expect(bootstrap).not.toContain("node:child_process");
    expect(bootstrap).not.toContain("node:fs");
    expect(bootstrap).not.toContain("node:module");
    expect(bootstrap).not.toContain("fileURLToPath");
    expect(bootstrap).not.toContain("npm root -g");
    expect(bootstrap).not.toContain("npm install failed");
    expect(bootstrap).not.toContain("readPackageVersion");
    expect(bootstrap).not.toContain("isNewerVersion");
    expect(bootstrap).not.toContain("stdio: \"inherit\"");
    expect(bootstrap).not.toContain("stdio: [\"ignore\", \"pipe\", \"pipe\"]");
    expect(bootstrap).not.toContain("child.stdout");
    expect(bootstrapProcess).toContain("node:child_process");
    expect(bootstrapProcess).toContain("spawnInheritedProcess");
    expect(bootstrapProcess).toContain("spawnCapturedProcess");
    expect(bootstrapPackage).toContain("findCurrentPackageRoot");
    expect(bootstrapPackage).toContain("readPackageVersion");
    expect(bootstrapPackage).toContain("shouldInstallGlobalPackage");
    expect(bootstrapPackage).toContain("isNewerVersion");
    expect(bootstrapNpm).toContain("resolveGlobalPackageRoot");
    expect(bootstrapNpm).toContain("installGlobalCodealmanacPackage");
    expect(bootstrapNpm).toContain("npm");
    expect(bootstrapNpm).toContain("spawnInheritedProcess");
    expect(bootstrapNpm).toContain("spawnCapturedProcess");
  });

  it("keeps setup provider login process execution in the platform layer", async () => {
    const setupAgentChoice = await readSource(
      "src/edges/cli/setup/agent-choice.ts",
    );
    const setupAgentProviderChoice = await readSource(
      "src/edges/cli/setup/agent-provider-choice.ts",
    );
    const setupProviderFixCommand = await readSource(
      "src/services/setup/provider-fix-command.ts",
    );
    const setupRuntimeContracts = await readSource(
      "src/shared/setup-runtime.ts",
    );
    const setupServiceIndex = await readSource("src/services/setup/index.ts");
    const platformSetupRuntime = await readSource("src/platform/setup/runtime.ts");
    const platformShell = await readSource("src/platform/shell.ts");

    expect(existsSync(join(ROOT, "src/platform/shell.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/setup/runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/setup/provider-fix-command.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/agent-provider-choice.ts"))).toBe(true);
    expect(setupAgentChoice).not.toContain("platform/shell.js");
    expect(setupAgentChoice).not.toContain("platform/setup/runtime.js");
    expect(setupAgentChoice).toContain("runProviderFixCommand:");
    expect(setupAgentChoice).not.toContain("runSetupProviderFixCommand");
    expect(setupAgentChoice).not.toContain("node:child_process");
    expect(setupAgentChoice).not.toContain("spawn(command");
    expect(setupAgentChoice).not.toContain("shell: true");
    expect(setupAgentChoice).not.toContain("stdio: \"inherit\"");
    expect(setupAgentProviderChoice).not.toContain("platform/shell.js");
    expect(setupAgentProviderChoice).not.toContain("platform/setup/runtime.js");
    expect(setupAgentProviderChoice).toContain("runSetupProviderFixCommand");
    expect(setupAgentProviderChoice).not.toContain("node:child_process");
    expect(setupAgentProviderChoice).not.toContain("spawn(command");
    expect(setupAgentProviderChoice).not.toContain("shell: true");
    expect(setupAgentProviderChoice).not.toContain("stdio: \"inherit\"");
    expect(setupProviderFixCommand).not.toContain("platform/");
    expect(setupProviderFixCommand).not.toContain("runInheritedShellCommand");
    expect(setupProviderFixCommand).toContain("SetupProviderFixCommandRunner");
    expect(setupProviderFixCommand).toContain("shared/setup-runtime.js");
    expect(setupRuntimeContracts).toContain("SetupProviderFixCommandRunner");
    expect(setupProviderFixCommand).toContain(
      "normalizeSetupProviderFixCommand",
    );
    expect(setupProviderFixCommand).toContain(
      "runnableSetupProviderFixCommand",
    );
    expect(setupServiceIndex).toContain("provider-fix-command.js");
    expect(platformSetupRuntime).toContain("runInheritedShellCommand");
    expect(platformShell).toContain("runInheritedShellCommand");
  });

  it("keeps setup provider and model choice UI separate", async () => {
    const setupAgentChoice = await readSource(
      "src/edges/cli/setup/agent-choice.ts",
    );
    const setupProviderChoice = await readSource(
      "src/edges/cli/setup/agent-provider-choice.ts",
    );
    const setupProviderDisplay = await readSource(
      "src/edges/cli/setup/agent-provider-display.ts",
    );
    const setupModelChoice = await readSource(
      "src/edges/cli/setup/agent-model-choice.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/setup/agent-model-choice.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/agent-provider-choice.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/agent-provider-display.ts"))).toBe(true);
    expect(setupAgentChoice).toContain("agent-model-choice.js");
    expect(setupAgentChoice).toContain("agent-provider-choice.js");
    expect(setupProviderChoice).toContain("agent-provider-display.js");
    expect(setupAgentChoice).not.toContain("readSetupProviderModelChoices");
    expect(setupAgentChoice).not.toContain("formatModelChoice");
    expect(setupAgentChoice).not.toContain("formatProviderChoice");
    expect(setupAgentChoice).not.toContain("showUnavailableProvider");
    expect(setupProviderChoice).not.toContain("readSetupProviderModelChoices");
    expect(setupAgentChoice).not.toContain("friendlyModelLabel");
    expect(setupAgentChoice).not.toContain("providerDisplayName");
    expect(setupProviderDisplay).toContain("formatProviderChoice");
    expect(setupProviderDisplay).toContain("showUnavailableProvider");
    expect(setupModelChoice).toContain("readSetupProviderModelChoices");
    expect(setupModelChoice).toContain("formatModelChoice");
  });

  it("keeps setup auto-commit UI out of config persistence mechanics", async () => {
    const autoCommitStep = await readSource(
      "src/edges/cli/setup/auto-commit-step.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/auto-commit.ts"))).toBe(true);
    expect(autoCommitStep).toContain("services/setup/index.js");
    expect(autoCommitStep).not.toContain("../../../config/index");
    expect(autoCommitStep).not.toContain("readConfig");
    expect(autoCommitStep).not.toContain("writeConfig");
  });

  it("keeps setup guide UI out of agent instruction install mechanics", async () => {
    const setupIndex = await readSource("src/edges/cli/setup/index.ts");
    const setupInstructions = await readSource("src/services/setup/instructions.ts");
    const setupUninstall = await readSource("src/services/setup/uninstall.ts");
    const sharedSetupInstructions = await readSource("src/shared/setup-instructions.ts");
    const appSetupRuntime = await readSource("src/app/setup-runtime.ts");
    const platformSetupInstructions = await readSource(
      "src/platform/setup/instructions.ts",
    );
    const guidesStep = await readSource("src/edges/cli/setup/guides-step.ts");
    const guides = await readSource("src/edges/cli/setup/guides.ts");
    const platformGuides = await readSource("src/platform/install/guides.ts");
    const setupRegistration = await readSource(
      "src/edges/cli/register-setup-command.ts",
    );
    const targetChoice = await readSource(
      "src/edges/cli/setup/instruction-target-choice.ts",
    );
    const multiSelect = await readSource("src/edges/cli/setup/multi-select.ts");

    expect(existsSync(join(ROOT, "src/services/setup/instructions.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/install/guides.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/setup/instructions.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/app/setup-runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/setup-instructions.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/setup/multi-select.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/install-targets.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/agent/instructions"))).toBe(false);
    expect(setupInstructions).not.toContain(
      "SetupInstructionTargetId = InstructionTargetId",
    );
    expect(setupInstructions).not.toContain(
      "SetupInstructionTarget = InstructionTarget",
    );
    expect(setupInstructions).not.toContain(
      "Promise<AgentInstructionsChange>",
    );
    expect(setupInstructions).not.toContain("homedir");
    expect(setupInstructions).not.toContain("homeDir?: string");
    expect(setupInstructions).toContain("homeDir: string");
    expect(setupInstructions).toContain("guidesDir: string");
    expect(setupInstructions).not.toContain("resolveSetupGuidesDir");
    expect(setupInstructions).not.toContain("createRequire");
    expect(setupInstructions).not.toContain("fileURLToPath");
    expect(setupInstructions).not.toContain("existsSync");
    expect(setupInstructions).not.toContain("agent/install-targets");
    expect(setupInstructions).not.toContain("agent/instructions");
    expect(setupInstructions).not.toContain("platform/setup");
    expect(setupInstructions).not.toContain("installAgentInstructions");
    expect(setupInstructions).toContain("SetupInstructionRuntime");
    expect(setupUninstall).not.toContain("agent/install-targets");
    expect(setupUninstall).not.toContain("platform/setup");
    expect(setupUninstall).not.toContain("removeAgentInstructions");
    expect(setupUninstall).toContain("SetupInstructionRuntime");
    expect(sharedSetupInstructions).toContain("interface SetupInstructionRuntime");
    expect(sharedSetupInstructions).toContain("SETUP_INSTRUCTION_TARGETS");
    expect(sharedSetupInstructions).toContain("SETUP_IMPORT_LINE");
    expect(platformSetupInstructions).toContain("installAgentInstructions");
    expect(platformSetupInstructions).toContain("removeAgentInstructions");
    expect(platformSetupInstructions).toContain("createPlatformSetupInstructionRuntime");
    expect(appSetupRuntime).toContain("createPlatformSetupInstructionRuntime");
    expect(platformGuides).toContain("resolveBundledGuidesDir");
    expect(platformGuides).toContain("createRequire");
    expect(platformGuides).toContain("fileURLToPath");
    expect(platformGuides).toContain("existsSync");
    expect(setupRegistration).toContain("resolveBundledGuidesDir()");
    expect(setupIndex).not.toContain("../../../agent");
    expect(targetChoice).toContain("multi-select.js");
    expect(targetChoice).not.toContain("setRawMode");
    expect(targetChoice).not.toContain("input.on(\"data\"");
    expect(targetChoice).not.toContain("removeListener");
    expect(multiSelect).toContain("setRawMode");
    expect(multiSelect).toContain("input.on(\"data\"");
    expect(multiSelect).toContain("removeListener");
    for (const source of [setupIndex, guidesStep, guides, targetChoice]) {
      expect(source).toContain("services/setup/index.js");
      expect(source).not.toContain("agent/install-targets");
      expect(source).not.toContain("agent/instructions/codex");
      expect(source).not.toContain("installAgentInstructions");
      expect(source).not.toContain("CLAUDE_IMPORT_LINE");
      expect(source).not.toContain("hasClaudeImportLine");
    }
    expect(guidesStep).toContain("createSetupInstructionRuntime");
  });

  it("keeps uninstall UI out of setup cleanup mechanics", async () => {
    const uninstallCommand = await readSource("src/edges/cli/uninstall.ts");
    const uninstallRender = await readSource(
      "src/edges/cli/uninstall-render.ts",
    );
    const setupUninstall = await readSource("src/services/setup/uninstall.ts");
    const uninstallRegistration = await readSource(
      "src/edges/cli/register-uninstall-command.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/uninstall.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/uninstall.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/uninstall-render.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/uninstall.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/uninstall-render.ts"))).toBe(
      true,
    );
    expect(setupUninstall).not.toContain("type AgentInstructionDirs");
    expect(setupUninstall).not.toContain("agent/install-targets");
    expect(setupUninstall).not.toContain("platform/setup");
    expect(setupUninstall).toContain("SetupInstructionRuntime");
    expect(setupUninstall).not.toContain(
      "SetupUninstallOptions extends AgentInstructionDirs",
    );
    expect(uninstallCommand).toContain("services/setup/index.js");
    expect(uninstallCommand).toContain("./uninstall-render.js");
    expect(uninstallCommand).toContain("createSetupInstructionRuntime");
    expect(uninstallCommand).not.toContain("agent/install-targets");
    expect(uninstallCommand).not.toContain("platform/automation/legacy-hooks");
    expect(uninstallCommand).not.toContain("runAutomationUninstall");
    expect(uninstallCommand).not.toContain("removeAgentInstructions");
    expect(uninstallCommand).not.toContain("cleanupLegacyHooks");
    expect(uninstallCommand).not.toContain("Uninstall complete");
    expect(uninstallCommand).not.toContain("Guides removed");
    expect(uninstallCommand).not.toContain("almanac: automation removed");
    expect(uninstallCommand).not.toContain("process.stdout");
    expect(uninstallCommand).not.toContain("process.stdin.isTTY");
    expect(uninstallCommand).not.toContain("process.stdin");
    expect(uninstallCommand).not.toContain("homedir");
    expect(uninstallRender).toContain("renderUninstallResult");
    expect(uninstallRender).toContain("formatAutomationResult");
    expect(uninstallRender).toContain("../../shared/ansi-theme.js");
    expect(uninstallRender).not.toContain("../../ansi.js");
    expect(uninstallRender).toContain("makeAnsiTheme(options.color === true)");
    expect(uninstallCommand).toContain("color?: boolean");
    expect(uninstallRegistration).toContain("isTTY: process.stdin.isTTY === true");
    expect(uninstallRegistration).toContain("stdin: process.stdin");
    expect(uninstallRegistration).toContain("stdout: process.stdout");
  });

  it("keeps setup cleanup services behind automation service cleanup verbs", async () => {
    const setupUninstall = await readSource("src/services/setup/uninstall.ts");

    expect(setupUninstall).toContain("cleanupLegacyAutomationHooks");
    expect(setupUninstall).not.toContain("platform/automation");
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}

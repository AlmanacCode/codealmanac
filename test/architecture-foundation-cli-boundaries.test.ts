import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries: foundation and CLI", () => {
  it("keeps global and repo path mechanics in store-owned modules", async () => {
    const globalPaths = await readSource("src/stores/global-paths.ts");
    const registryPaths = await readSource("src/stores/wiki-registry/paths.ts");
    const repoLocation = await readSource("src/stores/wiki-files/repo-location.ts");

    expect(existsSync(join(ROOT, "src/paths.ts"))).toBe(false);
    expect(globalPaths).toContain("getGlobalAlmanacDir");
    expect(registryPaths).toContain("getRegistryPath");
    expect(repoLocation).toContain("findNearestAlmanacDir");
    expect(repoLocation).toContain("getRepoAlmanacDir");
    expect(repoLocation).toContain("existsSync");
  });

  it("keeps wiki initialization inside service and store ownership", async () => {
    const initialization = await readSource("src/services/wiki/initialization.ts");
    const fileScaffold = await readSource("src/stores/wiki-files/scaffold.ts");
    const filePages = await readSource("src/stores/wiki-files/pages.ts");
    const pageSnapshots = await readSource(
      "src/stores/wiki-files/page-snapshots.ts",
    );
    const cliRuntime = await readSource("src/app/cli-runtime.ts");
    const registerInit = await readSource("src/edges/cli/register-init-command.ts");
    const initCommand = await readSource(
      "src/edges/cli/commands/operations/init.ts",
    );
    const buildOperation = await readSource(
      "src/services/lifecycle/operations/build.ts",
    );

    expect(existsSync(join(ROOT, "src/init"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/wiki/initialization.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/stores/wiki-files/scaffold.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/stores/wiki-files/pages.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki-files/page-snapshots.ts"))).toBe(
      true,
    );
    expect(initialization).toContain("scaffoldWikiFiles");
    expect(initialization).toContain("addEntry");
    expect(initialization).toContain("registryPathEquals");
    expect(initialization).not.toContain("platform/path-case");
    expect(initialization).not.toContain("writeFile");
    expect(initialization).not.toContain("mkdir");
    expect(fileScaffold).toContain("writeFile");
    expect(fileScaffold).toContain("mkdir");
    expect(fileScaffold).not.toContain("addEntry");
    expect(filePages).toContain("readdir");
    expect(filePages).toContain("countWikiPageFiles");
    expect(pageSnapshots).toContain("readFile");
    expect(pageSnapshots).toContain("snapshotWikiPages");
    expect(cliRuntime).toContain("pathsEqualOnCurrentPlatform");
    expect(registerInit).toContain("runtime.registryPathEquals");
    expect(initCommand).toContain("registryPathEquals");
    expect(buildOperation).toContain("from \"../../wiki/initialization.js\"");
    expect(buildOperation).toContain("registryPathEquals");
    expect(buildOperation).not.toContain("platform/path-case");
    expect(buildOperation).toContain("countWikiPageFiles");
    expect(buildOperation).not.toContain("node:fs");
    expect(buildOperation).not.toContain("readdir");
    expect(buildOperation).not.toContain("init/scaffold");
  });

  it("keeps src/cli.ts as a stable facade over the CLI edge runner", async () => {
    const facade = await readSource("src/cli.ts");

    expect(facade).toContain("from \"./edges/cli/run.js\"");
    expect(facade).not.toContain("from \"commander\"");
    expect(facade).not.toContain("cli/commands");
    expect(facade).not.toContain("platform/");
    expect(facade).not.toContain("jobs/");
    expect(existsSync(join(ROOT, "src/cli"))).toBe(false);
  });

  it("keeps process-level CLI machinery inside the CLI edge", async () => {
    const binShim = await readSource("bin/codealmanac.ts");
    const runner = await readSource("src/edges/cli/run.ts");
    const abiGuard = await readSource("src/edges/cli/abi-guard.ts");
    const help = await readSource("src/edges/cli/help.ts");
    const updateAnnounce = await readSource("src/edges/cli/update-announcement.ts");

    expect(existsSync(join(ROOT, "src/abi-guard.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/abi-guard.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/ansi.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/ansi-theme.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/slug.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/errors.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/shared/ansi-theme.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/slug.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/user-facing-error.ts"))).toBe(
      true,
    );
    expect(runner).toContain("from \"commander\"");
    expect(runner).toContain("tryRunInternalJob");
    expect(runner).toContain("readPackageVersion");
    expect(binShim).toContain("../src/edges/cli/abi-guard.js");
    expect(binShim).not.toContain("../src/abi-guard.js");
    expect(binShim).not.toContain("const sqliteFreeCommands");
    expect(abiGuard).toContain("checkSqliteAbi");
    expect(abiGuard).toContain("shouldCheckSqliteAbi");
    expect(abiGuard).toContain("../../platform/install/launcher-runtime.js");
    expect(help).toContain("../../shared/ansi-theme.js");
    expect(help).not.toContain("../../ansi.js");
    expect(help).toContain("shouldUseStdoutColor()");
    expect(updateAnnounce).toContain("../../shared/ansi-theme.js");
    expect(updateAnnounce).not.toContain("process.stderr.isTTY");
    expect(updateAnnounce).not.toContain("\\x1b[");
  });

  it("keeps CLI registration and shortcut parsing in the CLI edge", () => {
    const oldCliShellFiles = [
      "src/cli/help.ts",
      "src/cli/sqlite-free.ts",
      "src/cli/register-commands.ts",
      "src/cli/register-query-commands.ts",
      "src/cli/register-edit-commands.ts",
      "src/cli/register-setup-commands.ts",
      "src/cli/register-wiki-lifecycle-commands.ts",
      "src/edges/cli/register-wiki-lifecycle-commands.ts",
    ];

    for (const path of oldCliShellFiles) {
      expect(existsSync(join(ROOT, path)), path).toBe(false);
    }
  });

  it("keeps CLI command-family registration split by product surface", async () => {
    const registerCommands = await readSource(
      "src/edges/cli/register-commands.ts",
    );
    const registerSetup = await readSource(
      "src/edges/cli/register-setup-commands.ts",
    );
    const registerSetupCommand = await readSource(
      "src/edges/cli/register-setup-command.ts",
    );
    const registerDoctorCommand = await readSource(
      "src/edges/cli/register-doctor-command.ts",
    );
    const registerUpdateCommand = await readSource(
      "src/edges/cli/register-update-command.ts",
    );
    const registerUninstallCommand = await readSource(
      "src/edges/cli/register-uninstall-command.ts",
    );
    const registerAgents = await readSource(
      "src/edges/cli/register-agent-commands.ts",
    );
    const registerConfig = await readSource(
      "src/edges/cli/register-config-commands.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/register-agent-commands.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/register-config-commands.ts")))
      .toBe(true);
    expect(registerCommands).toContain("registerAgentCommands(program)");
    expect(registerCommands).toContain("registerConfigCommands(program)");
    expect(registerSetup).toContain("registerSetupCommand(program, deps)");
    expect(registerSetup).toContain("registerDoctorCommand(program, deps)");
    expect(registerSetup).toContain("registerUpdateCommand(program)");
    expect(registerSetup).toContain("registerUninstallCommand(program)");
    expect(registerSetup).not.toContain(".command(\"setup\")");
    expect(registerSetup).not.toContain(".command(\"doctor\")");
    expect(registerSetup).not.toContain(".command(\"update\")");
    expect(registerSetup).not.toContain(".command(\"uninstall\")");
    expect(registerSetup).not.toContain(".command(\"agents\")");
    expect(registerSetup).not.toContain(".command(\"config\")");
    expect(registerSetupCommand).toContain(".command(\"setup\")");
    expect(registerDoctorCommand).toContain(".command(\"doctor\")");
    expect(registerUpdateCommand).toContain(".command(\"update\")");
    expect(registerUninstallCommand).toContain(".command(\"uninstall\")");
    expect(registerAgents).toContain(".command(\"agents\")");
    expect(registerConfig).toContain(".command(\"config\")");
  });

  it("keeps ordinary command-result emission centralized in the CLI edge helper", async () => {
    const edgeHelpers = await readSource("src/edges/cli/helpers.ts");
    const outcome = await readSource("src/edges/cli/commands/outcome.ts");
    const registerMaintenance = await readSource(
      "src/edges/cli/register-maintenance-commands.ts",
    );
    const registerQuery = await readSource(
      "src/edges/cli/register-query-commands.ts",
    );
    const registerListCommand = await readSource(
      "src/edges/cli/register-list-command.ts",
    );

    expect(edgeHelpers).toContain("export function emit");
    expect(edgeHelpers).toContain("process.stdout.write");
    expect(edgeHelpers).toContain("process.stderr.write");
    expect(outcome).toContain("export interface CommandResult");
    expect(existsSync(join(ROOT, "src/cli/helpers.ts"))).toBe(false);

    expect(registerMaintenance).toContain("from \"./helpers.js\"");
    expect(registerMaintenance).toContain("emitCliWarning");
    expect(registerMaintenance).toContain("emit(result)");
    expect(registerMaintenance).not.toContain("process.stdout.write");
    expect(registerMaintenance).not.toContain("process.exitCode");

    expect(registerQuery).toContain("registerListCommand");
    expect(registerQuery).not.toContain("const result = await listWikis({");
    expect(registerListCommand).toContain("from \"./helpers.js\"");
    expect(registerListCommand).toContain("const result = await listWikis({");
    expect(registerListCommand).toContain("color: shouldUseStdoutColor()");
    expect(registerListCommand).toContain("emit(result)");
    expect(registerQuery).not.toContain("process.stdout.write(result.stdout)");
    expect(registerQuery).not.toContain("process.exitCode = result.exitCode");
  });

  it("keeps lifecycle command rendering out of workflow adapters", async () => {
    const initCommand = await readSource(
      "src/edges/cli/commands/operations/init.ts",
    );
    const absorbCommand = await readSource(
      "src/edges/cli/commands/operations/absorb.ts",
    );
    const gardenCommand = await readSource(
      "src/edges/cli/commands/operations/garden.ts",
    );
    const operationRender = await readSource(
      "src/edges/cli/commands/operations/render.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations-render.ts")))
      .toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations/init.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations/absorb.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations/garden.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations/render.ts")))
      .toBe(true);
    expect(initCommand).toContain("runInitOperationWorkflow");
    expect(absorbCommand).toContain("runAbsorbOperationWorkflow");
    expect(gardenCommand).toContain("runGardenOperationWorkflow");
    for (const command of [initCommand, absorbCommand, gardenCommand]) {
      expect(command).toContain("renderWorkflowResult");
      expect(command).not.toContain("renderOutcome");
      expect(command).not.toContain("renderError");
      expect(command).not.toContain("Reason:");
      expect(command).not.toContain("Browse the wiki");
    }
    expect(operationRender).toContain("renderOutcome");
    expect(operationRender).toContain("renderOperationFailureMessage");
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}

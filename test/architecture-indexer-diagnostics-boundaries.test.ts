import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries: indexer, diagnostics, and registry", () => {
  it("keeps indexer page planning out of SQLite write orchestration", async () => {
    const indexer = await readSource("src/stores/wiki/indexer/index.ts");
    const pagePlan = await readSource("src/stores/wiki/indexer/page-plan.ts");
    const pageWriter = await readSource("src/stores/wiki/indexer/page-writer.ts");
    const frontmatter = await readSource("src/stores/wiki/indexer/frontmatter.ts");
    const topicsYaml = await readSource("src/stores/wiki/indexer/topics-yaml.ts");

    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/page-plan.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/page-writer.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/warnings.ts"))).toBe(true);
    expect(indexer).toContain("buildIndexedPagesPlan");
    expect(indexer).toContain("applyIndexedPagesPlan");
    expect(indexer).not.toContain("fast-glob");
    expect(indexer).not.toContain("readFile");
    expect(indexer).not.toContain("statSync");
    expect(indexer).not.toContain("createHash");
    expect(indexer).not.toContain("parseFrontmatter");
    expect(indexer).not.toContain("normalizePageSources");
    expect(indexer).not.toContain("extractWikilinks");
    expect(indexer).not.toContain("INSERT INTO pages");
    expect(indexer).not.toContain("DELETE FROM file_refs");
    expect(indexer).not.toContain("normalizePath");
    expect(pagePlan).toContain("fast-glob");
    expect(pagePlan).toContain("parseFrontmatter");
    expect(pagePlan).toContain("normalizePageSources");
    expect(pageWriter).toContain("INSERT INTO pages");
    expect(pageWriter).toContain("DELETE FROM file_refs");
    expect(pageWriter).toContain("normalizePath");
    expect(indexer).not.toContain("process.stderr");
    expect(pagePlan).not.toContain("process.stderr");
    expect(frontmatter).not.toContain("process.stderr");
    expect(topicsYaml).not.toContain("process.stderr");
  });

  it("keeps frontmatter source coercion separate from document parsing", async () => {
    const frontmatter = await readSource("src/stores/wiki/indexer/frontmatter.ts");
    const frontmatterSources = await readSource(
      "src/stores/wiki/indexer/frontmatter-sources.ts",
    );
    const pageSources = await readSource("src/stores/wiki/indexer/page-sources.ts");

    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/frontmatter-sources.ts"))).toBe(true);
    expect(frontmatter).toContain("frontmatter-sources.js");
    expect(frontmatter).not.toContain("function coerceSource");
    expect(frontmatter).not.toContain("case \"conversation\"");
    expect(frontmatter).not.toContain("coerceDateString");
    expect(frontmatterSources).toContain("export type FrontmatterSource");
    expect(frontmatterSources).toContain("export function coerceFrontmatterSources");
    expect(pageSources).toContain("frontmatter-sources.js");
  });

  it("keeps doctor diagnostics out of the CLI command package", async () => {
    const doctorIndex = await readSource("src/edges/cli/commands/doctor/index.ts");
    const doctorRender = await readSource("src/edges/cli/commands/doctor/render.ts");
    const doctorFormat = await readSource("src/edges/cli/commands/doctor/format.ts");
    const doctorDiagnostics = await readSource("src/services/diagnostics/doctor.ts");
    const installDiagnostics = await readSource("src/services/diagnostics/install.ts");
    const appDiagnosticAuth = await readSource("src/app/diagnostic-auth.ts");
    const platformInstallDiagnostics = await readSource(
      "src/platform/diagnostics/install.ts",
    );
    const platformAutomationDiagnostics = await readSource(
      "src/platform/diagnostics/automation.ts",
    );
    const platformInstructionDiagnostics = await readSource(
      "src/platform/diagnostics/instructions.ts",
    );
    const sharedDiagnosticTypes = await readSource(
      "src/shared/diagnostics.ts",
    );
    const updateDiagnostics = await readSource("src/services/diagnostics/updates.ts");
    const updateStatusDiagnostics = await readSource(
      "src/services/diagnostics/update-status.ts",
    );
    const diagnosticsTypes = await readSource("src/services/diagnostics/types.ts");
    const diagnosticsIndex = await readSource("src/services/diagnostics/index.ts");
    const doctorRegistration = await readSource(
      "src/edges/cli/register-doctor-command.ts",
    );
    const diagnosticsRuntime = await readSource("src/app/diagnostics-runtime.ts");
    const doctorService = await readSource("src/services/wiki/doctor.ts");
    const doctorTypes = await readSource("src/services/wiki/doctor-types.ts");
    const doctorHealth = await readSource("src/services/wiki/doctor-health.ts");
    const doctorIndexService = await readSource(
      "src/services/wiki/doctor-index.ts",
    );
    const doctorAbsorbService = await readSource(
      "src/services/wiki/doctor-absorb.ts",
    );
    const indexDiagnostics = await readSource(
      "src/stores/wiki/indexer/diagnostics.ts",
    );
    const absorbLogFiles = await readSource(
      "src/stores/wiki-files/absorb-logs.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/commands/doctor/render.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/services/diagnostics/probes.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/platform/diagnostics/install.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/platform/diagnostics/auth.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/app/diagnostic-auth.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/diagnostics/types.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/shared/diagnostics.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/platform/diagnostics/updates.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/services/diagnostics/update-status.ts")))
      .toBe(true);
    expect(doctorIndex).toContain("services/diagnostics/index.js");
    expect(doctorIndex).toContain("./render.js");
    expect(doctorIndex).not.toContain("./install.js");
    expect(doctorIndex).not.toContain("./agents.js");
    expect(doctorIndex).not.toContain("./updates.js");
    expect(doctorIndex).not.toContain("./probes.js");
    expect(doctorIndex).not.toContain("formatReport");
    expect(doctorIndex).not.toContain("JSON.stringify");
    expect(doctorIndex).not.toContain("agent/");
    expect(doctorIndex).not.toContain("platform/");
    expect(doctorIndex).not.toContain("readConfig");
    expect(doctorIndex).not.toContain("readStateForDoctor");
    expect(doctorRender).toContain("renderDoctorReport");
    expect(doctorRender).toContain("formatReport");
    expect(doctorFormat).not.toContain("process.stdout");
    expect(doctorFormat).toContain("../../../shared/ansi-theme.js");
    expect(doctorFormat).not.toContain("../../../ansi.js");
    expect(doctorFormat).toContain("makeAnsiTheme(options.color === true)");
    expect(doctorFormat).not.toContain("DoctorOptions");
    expect(diagnosticsTypes).not.toContain("stdout?:");
    expect(diagnosticsTypes).toContain("claudeApiKeySet: boolean");
    expect(diagnosticsTypes).toContain("nodeVersion: string");
    expect(diagnosticsTypes).toContain("authStatus: DiagnosticsAuthStatus");
    expect(diagnosticsTypes).toContain("automationStatus: DiagnosticsAutomationStatus");
    expect(diagnosticsTypes).toContain("guideStatus: DiagnosticsGuideStatus");
    expect(diagnosticsTypes).toContain(
      "instructionEntriesStatus: DiagnosticsInstructionEntriesStatus",
    );
    expect(diagnosticsTypes).toContain("updateStatus: DiagnosticsUpdateStatus");
    expect(diagnosticsTypes).toContain("installStatus: DiagnosticsInstallStatus");
    expect(diagnosticsTypes).not.toContain("settingsPath?:");
    expect(diagnosticsTypes).not.toContain("almanacDir?:");
    expect(diagnosticsTypes).not.toContain("hookScriptPath?:");
    expect(diagnosticsTypes).not.toContain("updateStatePath?:");
    expect(diagnosticsTypes).not.toContain("updateConfigPath?:");
    expect(diagnosticsTypes).not.toContain("installPath?:");
    expect(diagnosticsTypes).not.toContain("versionOverride?:");
    expect(diagnosticsTypes).not.toContain("sqliteProbe?:");
    expect(doctorDiagnostics).not.toContain("readPackageVersion");
    expect(installDiagnostics).not.toContain("process.env");
    expect(installDiagnostics).not.toContain("process.version");
    expect(installDiagnostics).not.toContain("platform/automation");
    expect(installDiagnostics).not.toContain("homedir");
    expect(installDiagnostics).not.toContain("existsSync");
    expect(installDiagnostics).not.toContain("probeBetterSqlite3");
    expect(installDiagnostics).not.toContain("detectInstallPath");
    expect(installDiagnostics).not.toContain("checkAgentInstructions");
    expect(installDiagnostics).not.toContain("safeCheckAuth");
    expect(installDiagnostics).not.toContain("checkClaudeAuth");
    expect(updateDiagnostics).not.toContain("../../config/");
    expect(updateDiagnostics).not.toContain("../../platform/");
    expect(updateDiagnostics).not.toContain("readState");
    expect(updateDiagnostics).not.toContain("readConfig");
    expect(updateDiagnostics).not.toContain("readStateForDoctor");
    expect(updateStatusDiagnostics).toContain("readDiagnosticUpdateStatus");
    expect(updateStatusDiagnostics).toContain("stores/config/index.js");
    expect(updateStatusDiagnostics).toContain("stores/update/index.js");
    expect(updateStatusDiagnostics).not.toContain("../../platform/");
    expect(doctorRegistration).toContain("shouldUseStdoutColor()");
    expect(doctorRegistration).toContain("nodeVersion: process.version");
    expect(doctorRegistration).toContain("readDoctorRuntimeFacts");
    expect(doctorRegistration).toContain("homeDir: homedir()");
    expect(doctorRegistration).toContain("environment: process.env");
    expect(doctorRegistration).not.toContain("probeDiagnosticInstall");
    expect(doctorRegistration).not.toContain("probeDiagnosticClaudeAuth");
    expect(doctorRegistration).not.toContain("probeDiagnosticAutomation");
    expect(doctorRegistration).not.toContain("probeDiagnosticGuides");
    expect(doctorRegistration).not.toContain("probeDiagnosticInstructionEntries");
    expect(doctorRegistration).not.toContain("readDiagnosticUpdateStatus()");
    expect(diagnosticsRuntime).toContain("createAgentReadinessRuntime");
    expect(diagnosticsRuntime).toContain("readDiagnosticClaudeAuth");
    expect(diagnosticsRuntime).toContain("probeDiagnosticInstall");
    expect(diagnosticsRuntime).toContain("probeDiagnosticAutomation");
    expect(diagnosticsRuntime).toContain("probeDiagnosticGuides");
    expect(diagnosticsRuntime).toContain("probeDiagnosticInstructionEntries");
    expect(diagnosticsRuntime).toContain("readDiagnosticUpdateStatus");
    expect(doctorRegistration).not.toContain("color: process.stdout.isTTY === true");
    expect(appDiagnosticAuth).toContain("checkClaudeAuth");
    expect(appDiagnosticAuth).toContain("agent/providers/claude/auth");
    expect(appDiagnosticAuth).not.toContain("agent/readiness/providers");
    expect(platformInstallDiagnostics).toContain("probeBetterSqlite3");
    expect(platformInstallDiagnostics).toContain("readPackageVersion");
    expect(platformInstallDiagnostics).toContain("homedir()");
    expect(platformAutomationDiagnostics).toContain(
      "../automation/legacy-capture.js",
    );
    expect(platformAutomationDiagnostics).toContain("../automation/paths.js");
    expect(platformInstructionDiagnostics).toContain("checkAgentInstructions");
    expect(platformInstructionDiagnostics).toContain("homedir()");
    for (const platformDiagnostics of [
      platformInstallDiagnostics,
      platformAutomationDiagnostics,
      platformInstructionDiagnostics,
    ]) {
      expect(platformDiagnostics).not.toContain("services/diagnostics");
    }
    expect(sharedDiagnosticTypes).toContain("DiagnosticsInstallStatus");
    expect(sharedDiagnosticTypes).toContain("SqliteProbeResult");
    expect(sharedDiagnosticTypes).toContain("DiagnosticsSpawnCliFn");
    expect(sharedDiagnosticTypes).not.toContain("platform/");
    expect(sharedDiagnosticTypes).not.toContain("services/");
    expect(platformInstallDiagnostics).toContain("../../shared/diagnostics.js");
    expect(diagnosticsTypes).toContain("../../shared/diagnostics.js");
    expect(diagnosticsTypes).not.toContain("../../platform/diagnostics/types.js");
    expect(existsSync(join(ROOT, "src/platform/update/semver.ts"))).toBe(false);
    expect(diagnosticsTypes).not.toContain("agent/readiness/providers/claude");
    expect(diagnosticsTypes).not.toContain("from \"../../agent/types.js\"");
    expect(diagnosticsTypes).not.toContain("from \"../../stores/config/index.js\"");
    expect(diagnosticsTypes).not.toContain("DiagnosticsSpawnCliFn = SpawnCliFn");
    expect(diagnosticsTypes).not.toContain(
      "DiagnosticsSpawnedProcess = SpawnedProcess",
    );
    expect(diagnosticsTypes).not.toContain(
      "DiagnosticsProviderStatus = ProviderStatus",
    );
    expect(diagnosticsTypes).not.toContain(
      "DiagnosticsAgentProviderId = AgentProviderId",
    );
    expect(diagnosticsIndex).not.toContain("../../agent/");
    expect(diagnosticsIndex).not.toContain("../../config/");
    expect(doctorTypes).not.toContain("typeof collectHealthReport");
    expect(doctorHealth).not.toContain("../../stores/wiki/health/index");
    expect(doctorHealth).toContain("collectWikiHealthReport");
    expect(doctorService).toContain("readWikiIndexDiagnostics");
    expect(doctorDiagnostics).toContain("../wiki/doctor.js");
    expect(existsSync(join(ROOT, "src/services/diagnostics/doctor.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/indexer/diagnostics.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/doctor/install.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/doctor/agents.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/doctor/updates.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/doctor/probes.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/doctor/types.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/doctor/wiki.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/doctor/duration.ts"))).toBe(false);

    expect(doctorService).not.toContain("readdirSync");
    expect(doctorService).not.toContain("statSync");
    expect(doctorService).not.toContain("openIndex");
    expect(doctorService).not.toContain("findEntry");
    expect(doctorService).not.toContain("collectHealthReport");
    expect(doctorIndexService).not.toContain("existsSync");
    expect(doctorIndexService).not.toContain("statSync");
    expect(doctorIndexService).not.toContain("openIndex");
    expect(doctorIndexService).not.toContain("better-sqlite3");
    expect(doctorIndexService).not.toContain("SELECT COUNT");
    expect(doctorAbsorbService).toContain("findLatestAbsorbLogFile");
    expect(doctorAbsorbService).not.toContain("node:fs");
    expect(doctorAbsorbService).not.toContain("readdirSync");
    expect(doctorAbsorbService).not.toContain("statSync");
    expect(absorbLogFiles).toContain("readdirSync");
    expect(absorbLogFiles).toContain("statSync");
    expect(absorbLogFiles).toContain("findLatestAbsorbLogFile");
    expect(indexDiagnostics).toContain("openIndex");
    expect(indexDiagnostics).toContain("existsSync");
    expect(indexDiagnostics).toContain("statSync");
    expect(indexDiagnostics).toContain("WikiIndexDiagnostics");
  });

  it("keeps registry persistence in an explicit store", async () => {
    const autoRegistration = await readSource(
      "src/services/wiki/autoregistration.ts",
    );
    const registryStore = await readSource("src/stores/wiki-registry/store.ts");
    const cliAutoRegistration = await readSource(
      "src/edges/cli/autoregistration.ts",
    );
    const platformPathCase = await readSource("src/platform/path-case.ts");
    const sharedPathEquality = await readSource("src/shared/path-equality.ts");

    expect(existsSync(join(ROOT, "src/stores/wiki-registry/store.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/path-case.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/path-equality.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/autoregistration.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/wiki/registry/store.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/stores/wiki/registry/index.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/stores/wiki/registry"))).toBe(false);
    expect(sharedPathEquality).toContain("type PathEquality");
    expect(registryStore).toContain("shared/path-equality.js");
    expect(registryStore).not.toContain("RegistryPathEquality");
    expect(registryStore).toContain("pathEquals");
    expect(registryStore).not.toContain("platform/path-case");
    expect(registryStore).not.toContain("pathsEqualOnCurrentPlatform");
    expect(registryStore).not.toContain("process.platform");
    expect(registryStore).not.toContain("toLowerCase()");
    expect(autoRegistration).toContain("findRegistryEntry");
    expect(autoRegistration).toContain("RegistryPathLookupOptions");
    expect(autoRegistration).not.toContain("platform/path-case");
    expect(autoRegistration).not.toContain("existsSync");
    expect(autoRegistration).not.toContain("node:fs");
    expect(autoRegistration).not.toContain("process.platform");
    expect(autoRegistration).not.toContain("function samePath");
    expect(autoRegistration).not.toContain("toLowerCase()");
    expect(cliAutoRegistration).toContain("pathsEqualOnCurrentPlatform");
    expect(cliAutoRegistration).toContain("autoRegisterIfNeeded");
    expect(platformPathCase).toContain("PathEquality");
    expect(platformPathCase).toContain("process.platform");
    expect(platformPathCase).toContain("isCaseInsensitivePathPlatform");
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}

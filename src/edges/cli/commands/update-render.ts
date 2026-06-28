import type {
  UpdateInstallResult,
  UpdateWorkflowResult,
} from "../../../services/update/index.js";

export interface UpdateResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function renderUpdateResult(
  result: UpdateWorkflowResult,
): UpdateResult {
  switch (result.status) {
    case "notifier-updated":
      return renderNotifierUpdated(result.enabled);
    case "no-pending-dismiss":
      return ok(
        "almanac: no pending update to dismiss. " +
          "Run `almanac update --check` to query the registry.\n",
      );
    case "dismiss-already-current":
      return ok(
        `almanac: already on latest (${result.installed}); nothing to dismiss.\n`,
      );
    case "already-dismissed":
      return ok(`almanac: ${result.latest} already dismissed.\n`);
    case "dismissed":
      return ok(
        `almanac: dismissed ${result.latest}. The nag banner ` +
          `will not show for this version.\n` +
          `Run \`almanac update\` to upgrade, or \`almanac config set update_notifier true\` to re-enable nags.\n`,
      );
    case "registry-unreachable":
      return {
        stdout: "",
        stderr:
          `almanac: could not reach registry.npmjs.org (timeout or network error).\n` +
          `Installed: ${result.installed}. ${registryFailureSuffix(result.action)}\n`,
        exitCode: 1,
      };
    case "registry-missing-latest":
      return ok(
        `almanac: installed ${result.installed}; registry did not report a latest tag.\n`,
      );
    case "update-available":
      return ok(
        `Almanac ${result.latest} available (you're on ${result.installed})` +
          `${dismissedSuffix(result.dismissed)}.\n` +
          `Run: almanac update\n`,
      );
    case "up-to-date":
      return ok(`almanac: up to date (${result.installed}).\n`);
    case "dismissed-install-skipped":
      return ok(
        `almanac: ${result.latest} is available but dismissed; no install attempted.\n` +
          `Run \`almanac update --check\` to inspect update state.\n`,
      );
    case "install-in-progress":
      return ok("almanac: update already in progress; no install attempted.\n");
    case "install-result":
      return renderInstallResult(result.result);
  }
}

function ok(stdout: string): UpdateResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function renderInstallResult(result: UpdateInstallResult): UpdateResult {
  return {
    stdout: result.output,
    stderr: result.errorOutput,
    exitCode: result.code,
  };
}

function renderNotifierUpdated(enabled: boolean): UpdateResult {
  return {
    stdout: enabled
      ? "almanac: update notifier enabled. " +
        "The pre-command banner will show when a new version is available.\n"
      : "almanac: update notifier disabled. " +
        "No more pre-command banners. Run `almanac update --check` to see status.\n",
    stderr: enabled
      ? deprecatedNotifierFlagWarning("enable")
      : deprecatedNotifierFlagWarning("disable"),
    exitCode: 0,
  };
}

function dismissedSuffix(dismissed: boolean): string {
  return dismissed
    ? " (dismissed — banner suppressed; `almanac update` still installs)"
    : "";
}

function deprecatedNotifierFlagWarning(
  action: "enable" | "disable",
): string {
  return (
    `almanac: warning: \`almanac update --${action}-notifier\` is ` +
    `deprecated; use \`almanac config set update_notifier ${action === "enable"}\`.\n`
  );
}

function registryFailureSuffix(action: "check" | "install"): string {
  return action === "check"
    ? "No cached latest available."
    : "No install attempted.";
}

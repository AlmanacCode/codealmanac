import { makeAnsiTheme } from "../../ansi-theme.js";
import { readUpdateAnnouncement } from "../../services/update/index.js";
import { readInstalledVersion } from "../../platform/update/version.js";

export interface AnnounceUpdateOptions {
  statePath?: string;
  configPath?: string;
  installedVersion?: string;
  color?: boolean;
}

export function announceUpdateIfAvailable(
  stderr: NodeJS.WritableStream,
  opts: AnnounceUpdateOptions = {},
): void {
  const announcement = readUpdateAnnouncement({
    statePath: opts.statePath,
    configPath: opts.configPath,
    installedVersion: opts.installedVersion ?? readInstalledVersion(),
  });
  if (announcement === null) return;

  const useColor = opts.color ?? shouldUseStreamColor(stderr);
  const theme = makeAnsiTheme(useColor);
  const warn = useColor ? `${theme.YELLOW}${theme.BOLD}\u26a0${theme.RST}` : "!";
  const cmd = `${theme.BOLD}almanac update${theme.RST}`;
  stderr.write(
    `${warn} Almanac ${announcement.latestVersion} available ` +
      `(you're on ${announcement.installedVersion}) — run: ${cmd}\n`,
  );
}

function shouldUseStreamColor(stream: NodeJS.WritableStream): boolean {
  return streamIsTTY(stream) && !("NO_COLOR" in process.env);
}

function streamIsTTY(stream: NodeJS.WritableStream): boolean {
  return (stream as NodeJS.WritableStream & { isTTY?: boolean }).isTTY === true;
}

import {
  listConfigEntries,
  parseConfigKey,
  readConfigEntry,
  setConfigEntry,
  unsetConfigEntry,
} from "../../services/config/index.js";
import {
  renderConfigException,
  renderConfigGet,
  renderConfigList,
  renderConfigSet,
  renderConfigUnset,
  renderMissingConfigValue,
  renderUnknownConfigKey,
  type ConfigResult,
} from "./config-render.js";

export type { ConfigResult } from "./config-render.js";

interface ConfigCommandScope {
  cwd: string;
}

export async function runConfigList(opts: {
  cwd: string;
  json?: boolean;
  showOrigin?: boolean;
}): Promise<ConfigResult> {
  return renderConfigList(await listConfigEntries({ cwd: opts.cwd }), opts);
}

export async function runConfigGet(opts: {
  cwd: string;
  key: string;
  json?: boolean;
  showOrigin?: boolean;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return renderUnknownConfigKey(opts.key);
  return renderConfigGet(
    await readConfigEntry(key, { cwd: opts.cwd }),
    opts,
  );
}

export async function runConfigSet(opts: ConfigCommandScope & {
  key: string;
  value?: string;
  project?: boolean;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return renderUnknownConfigKey(opts.key);
  if (opts.value === undefined) {
    return renderMissingConfigValue(key);
  }
  try {
    return renderConfigSet(
      await setConfigEntry({
        key,
        value: opts.value,
        project: opts.project === true,
        cwd: opts.cwd,
      }),
    );
  } catch (err: unknown) {
    return renderConfigException(err);
  }
}

export async function runConfigUnset(opts: ConfigCommandScope & {
  key: string;
  project?: boolean;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return renderUnknownConfigKey(opts.key);
  return renderConfigUnset(
    await unsetConfigEntry({
      key,
      project: opts.project === true,
      cwd: opts.cwd,
    }),
  );
}

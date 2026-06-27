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

export async function runConfigList(opts: {
  json?: boolean;
  showOrigin?: boolean;
} = {}): Promise<ConfigResult> {
  return renderConfigList(await listConfigEntries({ cwd: process.cwd() }), opts);
}

export async function runConfigGet(opts: {
  key: string;
  json?: boolean;
  showOrigin?: boolean;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return renderUnknownConfigKey(opts.key);
  return renderConfigGet(
    await readConfigEntry(key, { cwd: process.cwd() }),
    opts,
  );
}

export async function runConfigSet(opts: {
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
        cwd: process.cwd(),
      }),
    );
  } catch (err: unknown) {
    return renderConfigException(err);
  }
}

export async function runConfigUnset(opts: {
  key: string;
  project?: boolean;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return renderUnknownConfigKey(opts.key);
  return renderConfigUnset(
    await unsetConfigEntry({
      key,
      project: opts.project === true,
      cwd: process.cwd(),
    }),
  );
}

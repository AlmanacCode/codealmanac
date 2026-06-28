import {
  listConfigEntries,
  readConfigEntryByKey,
  setConfigEntryByKey,
  unsetConfigEntryByKey,
} from "../../../services/config/index.js";
import {
  renderConfigException,
  renderConfigGet,
  renderConfigList,
  renderConfigSet,
  renderConfigUnset,
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
  return renderConfigGet(
    await readConfigEntryByKey({ key: opts.key, cwd: opts.cwd }),
    opts,
  );
}

export async function runConfigSet(opts: ConfigCommandScope & {
  key: string;
  value?: string;
  project?: boolean;
}): Promise<ConfigResult> {
  try {
    return renderConfigSet(
      await setConfigEntryByKey({
        key: opts.key,
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
  return renderConfigUnset(
    await unsetConfigEntryByKey({
      key: opts.key,
      project: opts.project === true,
      cwd: opts.cwd,
    }),
  );
}

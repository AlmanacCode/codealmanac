import {
  runUpdateWorkflow,
  type UpdateOptions,
} from "../../../services/update/index.js";
import { renderUpdateResult, type UpdateResult } from "./update-render.js";

/**
 * `almanac update` — manual upgrade command, the counterpart to the
 * persistent nag banner.
 *
 * Default action: shell out to `npm i -g codealmanac@latest` with
 * inherited stdio so the user sees real-time download/install/permission
 * output. Synchronous in the user's terminal — no background install,
 * no mid-invocation swap (see the pair review's Tier-B design for
 * rationale).
 *
 * Flags:
 *   --dismiss — mark the current `latest_version` as "don't nag about
 *     this one again". No install. Writes state and exits.
 *   --check — force a registry query regardless of the 24h cache.
 *     Shows the result and exits. No install.
 *   --enable-notifier / --disable-notifier — deprecated compatibility
 *     flags for `config set update_notifier true|false`.
 */

export type { UpdateOptions };
export type { UpdateResult } from "./update-render.js";

export async function runUpdate(
  opts: UpdateOptions,
): Promise<UpdateResult> {
  return renderUpdateResult(await runUpdateWorkflow(opts));
}

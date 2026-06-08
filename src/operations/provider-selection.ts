import { readConfig } from "../config/index.js";
import type { HarnessProviderId } from "../harness/types.js";
import type { OperationProviderSelection } from "./types.js";

export function parseUsing(value: string | undefined): OperationProviderSelection {
  if (value === undefined || value.trim().length === 0) {
    return { id: "codex" };
  }
  const [rawProvider, ...modelParts] = value.split("/");
  if (!isProviderId(rawProvider)) {
    throw new Error(
      `invalid --using "${value}" (expected claude, codex, or cursor)`,
    );
  }
  const model = modelParts.join("/");
  return {
    id: rawProvider,
    model: model.length > 0 ? model : undefined,
  };
}

export async function resolveOperationProviderSelection(options: {
  cwd: string;
  using?: string;
}): Promise<OperationProviderSelection> {
  if (options.using !== undefined) return parseUsing(options.using);
  const config = await readConfig({ cwd: options.cwd });
  const id = config.agent.default;
  const model = config.agent.models[id] ?? undefined;
  return { id, model: model ?? undefined };
}

function isProviderId(value: string | undefined): value is HarnessProviderId {
  return value === "claude" || value === "codex" || value === "cursor";
}

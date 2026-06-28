import { resolveGitHubSource } from "../github/source.js";
import {
  webAbsorbInputSource,
  type AbsorbInputSource,
  type ResolveSourceFn,
  type SourceRef,
} from "../../shared/absorb-sources.js";

export function createPlatformAbsorbSourceResolver(): ResolveSourceFn {
  return (ref, cwd) => resolvePlatformAbsorbSource({ ref, cwd });
}

async function resolvePlatformAbsorbSource(args: {
  ref: SourceRef;
  cwd: string;
}): Promise<AbsorbInputSource> {
  if (args.ref.provider === "github") {
    return resolveGitHubSource({ ref: args.ref, cwd: args.cwd });
  }
  if (args.ref.provider === "web") return webAbsorbInputSource(args.ref);

  const _exhaustive: never = args.ref;
  throw new Error(`unsupported source provider ${String(_exhaustive)}`);
}

import { resolve } from "node:path";

import {
  resolveGitHubSource,
} from "./github.js";
import type { Source } from "./source.js";
import { parseSourceRef, type SourceRef } from "./source-ref.js";

export type ResolvedIngestInput =
  | { kind: "path"; targets: string[]; paths: string[] }
  | { kind: "source"; targets: string[]; sources: Source[] };

export type ResolveSourceFn = (ref: SourceRef, cwd: string) => Promise<Source>;

export interface ResolveIngestInputOptions {
  cwd: string;
  inputs: string[];
  resolveSource?: ResolveSourceFn;
}

export async function resolveIngestInput(
  options: ResolveIngestInputOptions,
): Promise<
  | { ok: true; value: ResolvedIngestInput }
  | { ok: false; message: string }
> {
  const sourceRefs: SourceRef[] = [];
  const paths: string[] = [];
  for (const input of options.inputs) {
    const parsed = parseSourceRef(input);
    if (parsed.ok) {
      sourceRefs.push(parsed.value);
      continue;
    }
    if (parsed.reason === "not-source-ref") {
      paths.push(input);
      continue;
    }
    return { ok: false, message: parsed.message };
  }

  if (sourceRefs.length > 0 && paths.length > 0) {
    return {
      ok: false,
      message:
        "ingest cannot mix source refs and local paths yet; run separate ingest commands",
    };
  }

  if (sourceRefs.length > 0) {
    const resolveSource = options.resolveSource ?? defaultResolveSource;
    const sources: Source[] = [];
    for (const sourceRef of sourceRefs) {
      sources.push(await resolveSource(sourceRef, options.cwd));
    }
    return {
      ok: true,
      value: {
        kind: "source",
        targets: sources.map((source) => source.raw),
        sources,
      },
    };
  }

  const resolvedPaths = paths.map((path) => resolve(options.cwd, path));
  return {
    ok: true,
    value: {
      kind: "path",
      targets: resolvedPaths,
      paths: resolvedPaths,
    },
  };
}

function defaultResolveSource(ref: SourceRef, cwd: string): Promise<Source> {
  if (ref.provider === "github") {
    return resolveGitHubSource({ ref, cwd });
  }
  if (ref.provider === "web") {
    return Promise.resolve({
      kind: "web.url",
      raw: ref.raw,
      url: ref.url,
    });
  }
  const _exhaustive: never = ref;
  throw new Error(`unsupported source provider ${String(_exhaustive)}`);
}

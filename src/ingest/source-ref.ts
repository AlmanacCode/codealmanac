export type SourceRef = {
  raw: string;
  provider: "github";
  kind: "pr";
  id: string;
};

export type ParseSourceRefResult =
  | { ok: true; value: SourceRef }
  | { ok: false; reason: "not-source-ref" }
  | {
      ok: false;
      reason: "invalid-source-ref" | "unsupported-source-ref";
      message: string;
    };

export function parseSourceRef(input: string): ParseSourceRefResult {
  if (!input.startsWith("github:")) return { ok: false, reason: "not-source-ref" };

  const parts = input.split(":");
  const kind = parts[1] ?? "";
  const id = parts[2] ?? "";
  if (kind !== "pr") {
    return {
      ok: false,
      reason: "unsupported-source-ref",
      message: `unsupported GitHub source kind '${kind}' (supported: pr)`,
    };
  }
  if (parts.length !== 3 || !/^[1-9][0-9]*$/.test(id)) {
    return {
      ok: false,
      reason: "invalid-source-ref",
      message: `invalid GitHub PR source ref '${input}' (expected github:pr:<number>)`,
    };
  }
  return {
    ok: true,
    value: {
      raw: input,
      provider: "github",
      kind,
      id,
    },
  };
}

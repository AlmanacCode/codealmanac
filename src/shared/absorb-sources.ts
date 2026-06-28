export type AbsorbInputSource = GitHubAbsorbInputSource | WebAbsorbInputSource;

export interface GitHubAbsorbInputSource {
  kind: "github.pr" | "github.issue";
  raw: string;
  repo: string;
  url: string;
  number: string;
}

export interface WebAbsorbInputSource {
  kind: "web.url";
  raw: string;
  url: string;
}

export type SourceRef = GitHubSourceRef | WebSourceRef;

export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

export type GitHubSourceRef = {
  raw: string;
  provider: "github";
  kind: "pr" | "issue";
  id: string;
  repo?: GitHubRepoRef;
};

export type WebSourceRef = {
  raw: string;
  provider: "web";
  kind: "url";
  url: string;
};

export type ParseSourceRefResult =
  | { ok: true; value: SourceRef }
  | { ok: false; reason: "not-source-ref" }
  | {
      ok: false;
      reason: "invalid-source-ref" | "unsupported-source-ref";
      message: string;
    };

export type ResolveSourceFn = (
  ref: SourceRef,
  cwd: string,
) => Promise<AbsorbInputSource>;

export function parseSourceRef(input: string): ParseSourceRefResult {
  const githubUrl = parseGitHubUrl(input);
  if (githubUrl !== null) return { ok: true, value: githubUrl };

  const webUrl = parseWebUrl(input);
  if (webUrl !== null) return { ok: true, value: webUrl };

  if (!input.startsWith("github:")) return { ok: false, reason: "not-source-ref" };

  const parts = input.split(":");
  const kind = parts[1] ?? "";
  const id = parts[2] ?? "";
  if (kind !== "pr" && kind !== "issue") {
    return {
      ok: false,
      reason: "unsupported-source-ref",
      message: `unsupported GitHub source kind '${kind}' (supported: pr, issue)`,
    };
  }
  if (parts.length !== 3 || !/^[1-9][0-9]*$/.test(id)) {
    return {
      ok: false,
      reason: "invalid-source-ref",
      message: `invalid GitHub source ref '${input}' (expected github:pr:<number> or github:issue:<number>)`,
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

export function webAbsorbInputSource(ref: WebSourceRef): WebAbsorbInputSource {
  return {
    kind: "web.url",
    raw: ref.raw,
    url: ref.url,
  };
}

function parseGitHubUrl(input: string): GitHubSourceRef | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "github.com") return null;

  const [owner, repo, type, id] = url.pathname.replace(/^\/+/, "").split("/");
  if (
    owner === undefined ||
    repo === undefined ||
    type === undefined ||
    id === undefined ||
    !isSafeGitHubPart(owner) ||
    !isSafeGitHubPart(repo) ||
    !/^[1-9][0-9]*$/.test(id)
  ) {
    return null;
  }

  if (type !== "pull" && type !== "issues") return null;
  return {
    raw: input,
    provider: "github",
    kind: type === "pull" ? "pr" : "issue",
    id,
    repo: { owner, repo: repo.replace(/\.git$/, "") },
  };
}

function parseWebUrl(input: string): WebSourceRef | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return {
      raw: input,
      provider: "web",
      kind: "url",
      url: url.toString(),
    };
  } catch {
    return null;
  }
}

function isSafeGitHubPart(part: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(part);
}

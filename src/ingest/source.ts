export type Source = GitHubSource | WebSource;

export interface GitHubSource {
  kind: "github.pr" | "github.issue";
  raw: string;
  repo: string;
  url: string;
  number: string;
}

export interface WebSource {
  kind: "web.url";
  raw: string;
  url: string;
}

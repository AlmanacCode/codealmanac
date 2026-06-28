export interface TopicsCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TopicsListOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
  color?: boolean;
}

export interface TopicsShowOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
  color?: boolean;
  slug: string;
  descendants?: boolean;
}

export interface TopicsCreateOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
  name: string;
  parents?: string[];
}

export interface TopicsLinkOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
  child: string;
  parent: string;
}

export interface TopicsUnlinkOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
  child: string;
  parent: string;
}

export interface TopicsRenameOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
  oldSlug: string;
  newSlug: string;
}

export interface TopicsDeleteOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
  slug: string;
}

export interface TopicsDescribeOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
  slug: string;
  description: string;
}

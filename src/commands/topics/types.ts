export interface TopicsCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TopicsBaseOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
}

export interface TopicsListOptions extends TopicsBaseOptions {}

export interface TopicsShowOptions extends TopicsBaseOptions {
  slug: string;
  descendants?: boolean;
}

export interface TopicsCreateOptions extends TopicsBaseOptions {
  name: string;
  parents?: string[];
}

export interface TopicsLinkOptions extends TopicsBaseOptions {
  child: string;
  parent: string;
}

export interface TopicsUnlinkOptions extends TopicsLinkOptions {}

export interface TopicsRenameOptions extends TopicsBaseOptions {
  oldSlug: string;
  newSlug: string;
}

export interface TopicsDeleteOptions extends TopicsBaseOptions {
  slug: string;
}

export interface TopicsDescribeOptions extends TopicsBaseOptions {
  slug: string;
  description: string;
}

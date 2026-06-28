export type CloudProvider = "codex" | "claude";

export type CloudHookEvent = "UserPromptSubmit" | "Stop";

export type BranchSource = "transcript" | "git_fallback" | "missing";

export type RoutingStatus = "routable" | "missing_branch" | "missing_repo";

export type ConversationRole = "user" | "assistant" | "system" | "tool";

export interface CliLoginSession {
  sessionId: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
  status: "pending" | "authorized" | "complete" | "expired";
  token: string | null;
}

export interface CliMe {
  githubUserId: number;
  githubLogin: string;
}

export interface RepositoryResolveResult {
  repoId: number;
  accountId: number;
  fullName: string;
  defaultBranch: string;
}

export interface ConversationMessageUpload {
  role: ConversationRole;
  content: string;
  occurredAt?: string | null;
}

export interface ConversationTurnUpload {
  provider: CloudProvider;
  providerSessionId: string;
  transcriptPathHash: string;
  firstCwd: string;
  providerTurnId: string;
  branch: string | null;
  branchSource: BranchSource;
  routingStatus: RoutingStatus;
  headSha: string | null;
  startedAt: string;
  completedAt: string | null;
  messages: ConversationMessageUpload[];
}

export interface ConversationUploadResult {
  sourceId: string;
  turnId: string;
  routingStatus: RoutingStatus;
  messageCount: number;
}

export interface CloudCredentials {
  token: string;
  baseUrl: string;
  githubLogin?: string;
  savedAt: string;
}

export type ConnectorId = "notion";

export type ConnectorAuthProvider = "composio";

export interface ConnectorConnection {
  id: ConnectorId;
  provider: ConnectorAuthProvider;
  connectedAccountId: string;
  mode?: "api" | "cli";
  userId: string;
  authConfigId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorStore {
  version: 1;
  connectors: Partial<Record<ConnectorId, ConnectorConnection>>;
}

export type NotionSelector =
  | { kind: "workspace"; value: "notion" }
  | { kind: "page"; value: string }
  | { kind: "query"; value: string }
  | { kind: "data-source"; value: string };

export interface NormalizedSourceBundle {
  connector: "notion";
  selector: NotionSelector;
  fetchedAt: string;
  documents: NormalizedSourceDocument[];
  candidates?: NormalizedSourceCandidate[];
  limits: {
    candidateLimit: number;
    fullFetchLimit: number;
  };
}

export interface NormalizedSourceCandidate {
  id: string;
  object: string;
  title: string;
  url?: string;
  lastEditedTime?: string;
}

export interface NormalizedSourceDocument {
  id: string;
  title: string;
  url?: string;
  createdTime?: string;
  lastEditedTime?: string;
  parent?: string;
  properties?: Record<string, unknown>;
  text: string;
  omittedBlocks?: OmittedBlock[];
}

export interface OmittedBlock {
  blockId: string;
  type: string;
  reason: string;
}

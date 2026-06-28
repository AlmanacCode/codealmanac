import { UserFacingError } from "../errors.js";
import type {
  CliLoginSession,
  CliMe,
  ConversationTurnUpload,
  ConversationUploadResult,
  RepositoryResolveResult,
} from "./types.js";

export interface CloudClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export class CloudClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CloudClientOptions) {
    this.baseUrl = options.baseUrl;
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createLoginSession(): Promise<CliLoginSession> {
    return this.request<CliLoginSession>("/api/cli/auth/sessions", {
      method: "POST",
    });
  }

  async pollLoginSession(sessionId: string): Promise<CliLoginSession> {
    return this.request<CliLoginSession>(
      `/api/cli/auth/sessions/${encodeURIComponent(sessionId)}/poll`,
      { method: "POST" },
    );
  }

  async me(): Promise<CliMe> {
    return this.request<CliMe>("/api/cli/me", { method: "GET" });
  }

  async logout(): Promise<CliMe> {
    return this.request<CliMe>("/api/cli/logout", { method: "POST" });
  }

  async resolveRepository(fullName: string): Promise<RepositoryResolveResult> {
    return this.request<RepositoryResolveResult>("/api/cli/repositories/resolve", {
      method: "POST",
      body: JSON.stringify({ fullName }),
    });
  }

  async completeConversationTurn(
    repoId: number,
    upload: ConversationTurnUpload,
  ): Promise<ConversationUploadResult> {
    return this.request<ConversationUploadResult>(
      `/api/cli/repositories/${repoId}/conversation-turns/complete`,
      {
        method: "POST",
        body: JSON.stringify(upload),
      },
    );
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    if (this.token !== undefined) {
      headers.set("authorization", `Bearer ${this.token}`);
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      const body = await readResponseText(response);
      throw new CloudHttpError(path, response.status, response.statusText, body);
    }
    return response.json() as Promise<T>;
  }
}

export class CloudHttpError extends UserFacingError {
  readonly path: string;
  readonly status: number;
  readonly statusText: string;
  readonly body: string;

  constructor(path: string, status: number, statusText: string, body: string) {
    super(`Almanac Cloud request failed (${status} ${statusText})`, {
      data: { path, body },
    });
    this.path = path;
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

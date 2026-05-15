export interface ComposioClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface ComposioLinkSession {
  linkToken: string;
  redirectUrl: string;
  expiresAt: string;
  connectedAccountId: string;
}

export interface ComposioConnectedAccount {
  id: string;
  status: string;
  toolkit?: { slug?: string };
  authConfig?: { id?: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface ComposioProxyRequest {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  connectedAccountId: string;
  body?: Record<string, unknown>;
  parameters?: ComposioProxyParameter[];
}

export interface ComposioProxyParameter {
  name: string;
  value: string;
  type: "header" | "query";
}

export class ComposioError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly suggestedFix?: string,
  ) {
    super(message);
  }
}

export class ComposioClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ComposioClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://backend.composio.dev/api/v3.1";
    this.fetchImpl = options.fetch ?? fetch;
  }

  async createLinkSession(args: {
    authConfigId: string;
    userId: string;
    alias?: string;
  }): Promise<ComposioLinkSession> {
    const body: Record<string, unknown> = {
      auth_config_id: args.authConfigId,
      user_id: args.userId,
    };
    if (args.alias !== undefined) body.alias = args.alias;
    const json = await this.requestJson("/connected_accounts/link", {
      method: "POST",
      body,
    });
    const record = expectObject(json);
    return {
      linkToken: readString(record, "link_token"),
      redirectUrl: readString(record, "redirect_url"),
      expiresAt: readString(record, "expires_at"),
      connectedAccountId: readString(record, "connected_account_id"),
    };
  }

  async getConnectedAccount(id: string): Promise<ComposioConnectedAccount> {
    const json = await this.requestJson(`/connected_accounts/${encodeURIComponent(id)}`, {
      method: "GET",
    });
    const record = expectObject(json);
    const authConfig = maybeObject(record.auth_config);
    const toolkit = maybeObject(record.toolkit);
    return {
      id: readString(record, "id"),
      status: readString(record, "status"),
      toolkit: toolkit === null ? undefined : { slug: maybeString(toolkit.slug) },
      authConfig: authConfig === null ? undefined : { id: maybeString(authConfig.id) },
      createdAt: maybeString(record.created_at),
      updatedAt: maybeString(record.updated_at),
    };
  }

  async deleteConnectedAccount(id: string): Promise<void> {
    await this.requestJson(`/connected_accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async proxyExecute(request: ComposioProxyRequest): Promise<unknown> {
    const body: Record<string, unknown> = {
      endpoint: request.endpoint,
      method: request.method,
      connected_account_id: request.connectedAccountId,
    };
    if (request.body !== undefined) body.body = request.body;
    if (request.parameters !== undefined) body.parameters = request.parameters;
    const json = await this.requestJson("/tools/execute/proxy", {
      method: "POST",
      body,
    });
    const record = expectObject(json);
    const status = typeof record.status === "number" ? record.status : 200;
    if (status >= 400) {
      throw new ComposioError(
        `Composio proxy request failed with upstream status ${status}`,
        status,
      );
    }
    return record.data;
  }

  private async requestJson(
    path: string,
    args: { method: string; body?: Record<string, unknown> },
  ): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: args.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.options.apiKey,
      },
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
    });
    const json = await readJsonResponse(response);
    if (!response.ok) {
      const error = extractComposioError(json);
      throw new ComposioError(error.message, response.status, error.suggestedFix);
    }
    return json;
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ComposioError(`Composio returned non-JSON response`, response.status);
  }
}

function extractComposioError(json: unknown): {
  message: string;
  suggestedFix?: string;
} {
  const record = maybeObject(json);
  const error = record === null ? null : maybeObject(record.error);
  if (error !== null) {
    return {
      message: maybeString(error.message) ?? "Composio request failed",
      suggestedFix: maybeString(error.suggested_fix) ?? maybeString(error.suggestedFix),
    };
  }
  return { message: "Composio request failed" };
}

function expectObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ComposioError("Composio returned an unexpected response shape");
  }
  return value as Record<string, unknown>;
}

function maybeObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ComposioError(`Composio response is missing ${key}`);
  }
  return value;
}

function maybeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

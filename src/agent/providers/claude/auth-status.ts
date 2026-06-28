export interface ClaudeAuthStatus {
  loggedIn: boolean;
  email?: string;
  subscriptionType?: string;
  authMethod?: string;
}

export function parseClaudeAuthStatus(raw: string): ClaudeAuthStatus {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const loggedIn = parsed.loggedIn === true;
  const out: ClaudeAuthStatus = { loggedIn };
  if (typeof parsed.email === "string") out.email = parsed.email;
  if (typeof parsed.subscriptionType === "string") {
    out.subscriptionType = parsed.subscriptionType;
  }
  if (typeof parsed.authMethod === "string") {
    out.authMethod = parsed.authMethod;
  }
  return out;
}

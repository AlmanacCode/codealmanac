interface CodexServerRequestResponders {
  respond: (id: string | number, result: unknown) => void;
  respondError: (id: string | number, code: number, message: string) => void;
  respondUnsupported: (id: string | number, method: string) => void;
}

export function respondToCodexServerRequest(
  id: string | number,
  method: string,
  responders: CodexServerRequestResponders,
): void {
  switch (method) {
    case "item/commandExecution/requestApproval":
      responders.respond(id, { decision: "decline" });
      return;
    case "item/fileChange/requestApproval":
      responders.respond(id, { decision: "decline" });
      return;
    case "execCommandApproval":
    case "applyPatchApproval":
      responders.respond(id, { decision: "denied" });
      return;
    case "item/tool/requestUserInput":
      responders.respond(id, { answers: {} });
      return;
    case "mcpServer/elicitation/request":
      responders.respond(id, { action: "decline", content: null, _meta: null });
      return;
    case "item/tool/call":
      responders.respond(id, { contentItems: [], success: false });
      return;
    case "item/permissions/requestApproval":
      responders.respond(id, {
        permissions: {},
        scope: "turn",
        strictAutoReview: true,
      });
      return;
    case "account/chatgptAuthTokens/refresh":
      responders.respondError(
        id,
        -32001,
        "Almanac does not manage ChatGPT auth tokens for Codex app-server.",
      );
      return;
    default:
      responders.respondUnsupported(id, method);
  }
}

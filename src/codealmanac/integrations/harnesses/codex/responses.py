from dataclasses import dataclass

from codealmanac.integrations.harnesses.fields import JsonObject


@dataclass(frozen=True)
class ServerResponse:
    result: JsonObject | None = None
    error: JsonObject | None = None


def noninteractive_response(method: str) -> ServerResponse:
    if method in {
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
    }:
        return ServerResponse(result={"decision": "decline"})
    if method in {"execCommandApproval", "applyPatchApproval"}:
        return ServerResponse(result={"decision": "denied"})
    if method == "item/tool/requestUserInput":
        return ServerResponse(result={"answers": {}})
    if method == "mcpServer/elicitation/request":
        return ServerResponse(
            result={"action": "decline", "content": None, "_meta": None}
        )
    if method == "item/tool/call":
        return ServerResponse(result={"contentItems": [], "success": False})
    if method == "item/permissions/requestApproval":
        return ServerResponse(
            result={"permissions": {}, "scope": "turn", "strictAutoReview": True}
        )
    if method == "account/chatgptAuthTokens/refresh":
        return ServerResponse(
            error={
                "code": -32001,
                "message": (
                    "CodeAlmanac does not manage ChatGPT auth tokens for "
                    "Codex app-server."
                ),
            }
        )
    return ServerResponse(
        error={
            "code": -32601,
            "message": f"CodeAlmanac does not handle Codex app-server request {method}",
        }
    )

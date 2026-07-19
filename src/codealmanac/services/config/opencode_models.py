"""OpenCode model id rules (provider/model). Discovery lives in integrations."""

from __future__ import annotations

OPENCODE_DEFAULT_MODEL = "opencode/big-pickle"
OPENCODE_FALLBACK_MODELS = (
    OPENCODE_DEFAULT_MODEL,
    "opencode/deepseek-v4-flash-free",
    "opencode-go/kimi-k2.7-code",
    "anthropic/claude-sonnet-4-5",
    "openai/gpt-5.4",
    "google/gemini-3.1-pro-preview",
)


def is_opencode_model_id(value: str) -> bool:
    """True for OpenCode model ids: provider/model (model may contain '/')."""
    token = value.strip()
    if token == "" or any(ch.isspace() for ch in token):
        return False
    provider, separator, model = token.partition("/")
    return separator == "/" and provider != "" and model != ""

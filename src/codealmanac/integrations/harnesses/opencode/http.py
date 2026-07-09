import httpx

from codealmanac.integrations.harnesses.fields import JsonObject, as_record

OPENCODE_ALLOW_ALL_PERMISSION: tuple[JsonObject, ...] = (
    {"permission": "*", "pattern": "*", "action": "allow"},
)


def get_providers(base_url: str, timeout_seconds: float) -> tuple[JsonObject, ...]:
    response = httpx.get(f"{base_url}/config/providers", timeout=timeout_seconds)
    response.raise_for_status()
    payload = as_record(response.json())
    providers = payload.get("providers")
    if not isinstance(providers, list):
        return ()
    return tuple(as_record(item) for item in providers if isinstance(item, dict))


def create_session(
    base_url: str,
    cwd_directory: str,
    title: str,
    timeout_seconds: float,
) -> JsonObject:
    response = httpx.post(
        f"{base_url}/session",
        params={"directory": cwd_directory},
        json={"title": title, "permission": list(OPENCODE_ALLOW_ALL_PERMISSION)},
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    return as_record(response.json())


def post_message(
    base_url: str,
    session_id: str,
    cwd_directory: str,
    provider_id: str,
    model_id: str,
    prompt: str,
    timeout_seconds: float,
) -> JsonObject:
    response = httpx.post(
        f"{base_url}/session/{session_id}/message",
        params={"directory": cwd_directory},
        json={
            "model": {"providerID": provider_id, "modelID": model_id},
            "parts": [{"type": "text", "text": prompt}],
        },
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    return as_record(response.json())

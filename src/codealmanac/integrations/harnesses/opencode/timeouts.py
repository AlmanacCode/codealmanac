import os


def env_seconds(name: str, fallback: float) -> float:
    value = os.environ.get(name)
    if value is None:
        return fallback
    try:
        parsed = float(value)
    except ValueError:
        return fallback
    if parsed <= 0:
        return fallback
    return parsed

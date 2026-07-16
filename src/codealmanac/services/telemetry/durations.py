def duration_bucket(seconds: float) -> str:
    if seconds < 0.25:
        return "<250ms"
    if seconds < 1:
        return "250ms-1s"
    if seconds < 10:
        return "1-10s"
    if seconds < 60:
        return "10-60s"
    if seconds < 300:
        return "1-5m"
    return "5m+"

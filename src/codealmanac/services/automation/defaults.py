from datetime import timedelta

DEFAULT_SYNC_INTERVAL = timedelta(hours=5)
DEFAULT_GARDEN_INTERVAL = timedelta(hours=4)
DEFAULT_UPDATE_INTERVAL = timedelta(days=1)

SYNC_LABEL = "com.codealmanac.sync"
GARDEN_LABEL = "com.codealmanac.garden"
UPDATE_LABEL = "com.codealmanac.update"

LAUNCHD_FALLBACK_PATHS = (
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
)


def duration_text(value: timedelta) -> str:
    seconds = int(value.total_seconds())
    if seconds == 0:
        return "0s"
    if seconds % 3600 == 0:
        return f"{seconds // 3600}h"
    if seconds % 60 == 0:
        return f"{seconds // 60}m"
    return f"{seconds}s"

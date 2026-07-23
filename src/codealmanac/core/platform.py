import platform
import sys


def scheduler_supported() -> bool:
    """True when this platform has a scheduler backend CodeAlmanac can drive.

    Today the only backend is macOS launchd. Option B (systemd user timers)
    will widen this. Consulted at the composition root to pick the scheduler
    adapter, and in render to decide what to tell the user about scheduling.
    """
    return sys.platform == "darwin"


def platform_label() -> str:
    """Human-facing OS name for messaging, e.g. "Linux"."""
    return platform.system() or sys.platform

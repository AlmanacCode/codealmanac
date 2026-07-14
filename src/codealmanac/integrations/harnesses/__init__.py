from pathlib import Path

from codealmanac.integrations.harnesses.yoke import YokeHarnessAdapter
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.harnesses.ports import HarnessAdapter


def default_harness_adapters(runtime_root: Path) -> tuple[HarnessAdapter, ...]:
    return (
        YokeHarnessAdapter(HarnessKind.CLAUDE, runtime_root),
        YokeHarnessAdapter(HarnessKind.CODEX, runtime_root),
    )

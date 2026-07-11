from codealmanac.integrations.harnesses.yoke import YokeHarnessAdapter
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.harnesses.ports import HarnessAdapter


def default_harness_adapters() -> tuple[HarnessAdapter, ...]:
    return (
        YokeHarnessAdapter(HarnessKind.CLAUDE),
        YokeHarnessAdapter(HarnessKind.CODEX),
    )

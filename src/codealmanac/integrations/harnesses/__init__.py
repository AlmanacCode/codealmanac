from codealmanac.integrations.harnesses.claude.adapter import ClaudeSdkHarnessAdapter
from codealmanac.integrations.harnesses.codex.adapter import (
    CodexAppServerHarnessAdapter,
)
from codealmanac.services.harnesses.ports import HarnessAdapter


def default_harness_adapters() -> tuple[HarnessAdapter, ...]:
    return (ClaudeSdkHarnessAdapter(), CodexAppServerHarnessAdapter())

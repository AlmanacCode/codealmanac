from codealmanac.integrations.harnesses.claude.adapter import ClaudeSdkHarnessAdapter
from codealmanac.integrations.harnesses.codex.adapter import (
    CodexAppServerHarnessAdapter,
)
from codealmanac.integrations.harnesses.opencode.adapter import (
    OpencodeHarnessAdapter,
)
from codealmanac.services.harnesses.ports import HarnessAdapter


def default_harness_adapters() -> tuple[HarnessAdapter, ...]:
    return (
        ClaudeSdkHarnessAdapter(),
        CodexAppServerHarnessAdapter(),
        OpencodeHarnessAdapter(),
    )

from collections.abc import Sequence

from codealmanac.core.errors import ConflictError, NotFoundError
from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
)
from codealmanac.services.harnesses.ports import HarnessAdapter
from codealmanac.services.harnesses.requests import RunHarnessRequest


class HarnessesService:
    def __init__(self, adapters: Sequence[HarnessAdapter] = ()):
        self.adapters = adapters_by_kind(adapters)

    def check(self) -> tuple[HarnessReadiness, ...]:
        return tuple(adapter.check() for adapter in self.adapters.values())

    def readiness(self, kind: HarnessKind) -> HarnessReadiness:
        try:
            adapter = self.adapter_for(kind)
        except NotFoundError:
            return HarnessReadiness(
                kind=kind,
                available=False,
                message=f"no {kind.value} harness adapter is registered",
            )
        return adapter.check()

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        return self.adapter_for(request.kind).run(request)

    def adapter_for(self, kind: HarnessKind) -> HarnessAdapter:
        try:
            return self.adapters[kind]
        except KeyError as error:
            raise NotFoundError("harness", kind.value) from error


def adapters_by_kind(
    adapters: Sequence[HarnessAdapter],
) -> dict[HarnessKind, HarnessAdapter]:
    indexed: dict[HarnessKind, HarnessAdapter] = {}
    for adapter in adapters:
        if adapter.kind in indexed:
            raise ConflictError(f"duplicate harness adapter: {adapter.kind.value}")
        indexed[adapter.kind] = adapter
    return indexed

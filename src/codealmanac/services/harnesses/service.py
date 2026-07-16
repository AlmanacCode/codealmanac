from collections.abc import Sequence

from codealmanac.core.errors import ConflictError, ExecutionFailed, NotFoundError
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
)
from codealmanac.services.harnesses.ports import HarnessAdapter, HarnessEventSink
from codealmanac.services.harnesses.requests import RunHarnessRequest


class HarnessUnavailable(ExecutionFailed):
    """The selected harness exists but cannot currently start a run."""


class HarnessEventSinkFailed(Exception):
    """The caller's event sink failed during an otherwise provider-owned run."""

    def __init__(self, error: Exception):
        super().__init__(error.__class__.__name__)
        self.error = error


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

    def ensure_ready(self, kind: HarnessKind) -> HarnessReadiness:
        readiness = self.adapter_for(kind).check()
        if readiness.available:
            return readiness
        raise HarnessUnavailable(
            unavailable_harness_message(readiness, self.alternatives_to(kind))
        )

    def run_ready(
        self,
        request: RunHarnessRequest,
        on_event: HarnessEventSink | None = None,
    ) -> HarnessRunResult:
        if on_event is None:
            return self.adapter_for(request.kind).run(request)

        def guarded_event_sink(event: HarnessEvent) -> None:
            try:
                on_event(event)
            except Exception as error:
                raise HarnessEventSinkFailed(error) from error

        return self.adapter_for(request.kind).run(request, guarded_event_sink)

    def alternatives_to(self, kind: HarnessKind) -> tuple[HarnessKind, ...]:
        return tuple(other for other in self.adapters if other != kind)

    def adapter_for(self, kind: HarnessKind) -> HarnessAdapter:
        try:
            return self.adapters[kind]
        except KeyError as error:
            raise NotFoundError("harness", kind.value) from error


def unavailable_harness_message(
    readiness: HarnessReadiness,
    alternatives: tuple[HarnessKind, ...],
) -> str:
    # One line on purpose: run records and job errors keep only the first line.
    message = f"harness {readiness.kind.value} is not available: {readiness.message}"
    if readiness.repair is not None:
        message = f"{message} — {readiness.repair}"
    if alternatives:
        options = " or ".join(kind.value for kind in alternatives)
        message = (
            f"{message}; or switch harness: "
            f"codealmanac config set harness.default {options}"
        )
    return message


def adapters_by_kind(
    adapters: Sequence[HarnessAdapter],
) -> dict[HarnessKind, HarnessAdapter]:
    indexed: dict[HarnessKind, HarnessAdapter] = {}
    for adapter in adapters:
        if adapter.kind in indexed:
            raise ConflictError(f"duplicate harness adapter: {adapter.kind.value}")
        indexed[adapter.kind] = adapter
    return indexed

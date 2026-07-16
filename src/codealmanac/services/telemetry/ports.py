from typing import Protocol

from codealmanac.services.telemetry.models import TelemetryEvent


class TelemetrySender(Protocol):
    def send(self, event: TelemetryEvent) -> None: ...

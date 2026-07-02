from codealmanac.services.control.models import ControlSchemaStatus
from codealmanac.services.control.requests import (
    EnsureControlSchemaRequest,
    ReadControlSchemaStatusRequest,
)
from codealmanac.services.control.store import ControlStore


class ControlService:
    def __init__(self, store: ControlStore):
        self.store = store

    def ensure_ready(
        self,
        request: EnsureControlSchemaRequest | None = None,
    ) -> ControlSchemaStatus:
        _ = request or EnsureControlSchemaRequest()
        return self.store.ensure_ready()

    def status(
        self,
        request: ReadControlSchemaStatusRequest | None = None,
    ) -> ControlSchemaStatus:
        resolved = request or ReadControlSchemaStatusRequest()
        return self.store.status(resolved.ensure)

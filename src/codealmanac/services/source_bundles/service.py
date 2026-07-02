from codealmanac.services.source_bundles.models import MaterializedSourceBundle
from codealmanac.services.source_bundles.requests import (
    MaterializeSourceBundleRequest,
)
from codealmanac.services.source_bundles.store import SourceBundlesStore


class SourceBundlesService:
    def __init__(self, store: SourceBundlesStore):
        self.store = store

    def materialize(
        self,
        request: MaterializeSourceBundleRequest,
    ) -> MaterializedSourceBundle:
        return self.store.materialize(request)

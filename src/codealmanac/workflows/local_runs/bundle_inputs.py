from collections.abc import Iterable

from codealmanac.services.control.models import SessionRecord
from codealmanac.services.source_bundles.models import SourceBundleSessionInput


def source_bundle_session_inputs(
    sessions: Iterable[SessionRecord],
) -> tuple[SourceBundleSessionInput, ...]:
    return tuple(
        SourceBundleSessionInput(
            session_id=session.id,
            provider=session.provider.value,
            provider_session_id=session.provider_session_id,
            source_ref=session.source_ref,
        )
        for session in sessions
    )

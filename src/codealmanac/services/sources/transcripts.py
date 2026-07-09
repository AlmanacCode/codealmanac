from codealmanac.services.sources.models import TranscriptCandidate


def transcript_sort_key(candidate: TranscriptCandidate) -> tuple[str, str, str]:
    return (
        candidate.app.value,
        str(candidate.transcript_path),
        candidate.session_id,
    )


def transcript_address(candidate: TranscriptCandidate) -> str:
    """The "transcript:<address>" identifier for a candidate.

    Stays app-agnostic on purpose: a discovery adapter sets
    address_override when transcript_path alone can't address one session
    (see TranscriptCandidate.address_override) — this file never needs to
    know which app or why.
    """
    return candidate.address_override or str(candidate.transcript_path)

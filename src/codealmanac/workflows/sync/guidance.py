from codealmanac.workflows.sync.models import SyncWorkItem


def sync_ingest_guidance(item: SyncWorkItem) -> str:
    lines = [
        "Scheduled sync:",
        f"- Repository: {item.repository.name}",
        f"- Repository root: {item.repository.root_path}",
        f"- Transcripts active since the last completed scan: {len(item.transcripts)}",
        "- Read the listed transcripts and update the wiki only for durable "
        "project knowledge.",
    ]
    for candidate in item.transcripts:
        lines.append(
            f"- {candidate.app.value} {candidate.session_id}: "
            f"{candidate.transcript_path}"
        )
    return "\n".join(lines)

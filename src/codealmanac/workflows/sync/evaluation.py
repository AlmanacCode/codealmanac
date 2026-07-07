from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.requests import SelectRepositoryRequest
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.sources.models import TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest
from codealmanac.services.sources.service import SourcesService
from codealmanac.workflows.sync.models import (
    SyncEvaluation,
    SyncMode,
    SyncSkipped,
    SyncSummary,
    SyncWorkItem,
)
from codealmanac.workflows.sync.requests import SyncSelectionRequest
from codealmanac.workflows.sync.store import SyncStateStore
from codealmanac.workflows.sync.summary import (
    ready_repository,
    skipped_transcript,
)


class SyncEvaluator:
    def __init__(
        self,
        repositories: RepositoriesService,
        sources: SourcesService,
        state_store: SyncStateStore,
    ):
        self.repositories = repositories
        self.sources = sources
        self.state_store = state_store

    def evaluate(
        self,
        request: SyncSelectionRequest,
        mode: SyncMode,
        now: datetime | None = None,
    ) -> SyncEvaluation:
        current_time = now or request.now or datetime.now(UTC)
        active_since = self.active_since(request, current_time)
        transcripts = self.sources.discover_transcripts(
            DiscoverTranscriptsRequest(
                home=normalize_path(request.home or Path.home()),
                apps=request.apps,
            )
        )
        selected_repositories = self.selected_repositories(request)
        skipped: list[SyncSkipped] = []
        transcripts_by_repository_id: dict[str, list[TranscriptCandidate]] = (
            defaultdict(list)
        )
        repositories_by_id = {
            repository.repository_id: repository
            for repository in selected_repositories
        }
        repositories_by_path = {
            normalize_path(repository.root_path): repository
            for repository in selected_repositories
        }
        for transcript in transcripts:
            repository = repositories_by_path.get(normalize_path(transcript.cwd))
            if repository is None:
                skipped.append(skipped_transcript(transcript, "unregistered-cwd"))
                continue
            if transcript.modified_at < active_since:
                skipped.append(skipped_transcript(transcript, "inactive"))
                continue
            transcripts_by_repository_id[repository.repository_id].append(transcript)

        work_items = tuple(
            SyncWorkItem(
                repository=repositories_by_id[repository_id],
                transcripts=tuple(sorted(transcripts, key=transcript_sort_key)),
            )
            for repository_id, transcripts in sorted(
                transcripts_by_repository_id.items()
            )
        )
        ready = tuple(ready_repository(item) for item in work_items)
        summary = SyncSummary(
            mode=mode,
            since=active_since,
            scanned=len(transcripts),
            eligible=sum(len(item.transcripts) for item in work_items),
            ready=ready if mode == SyncMode.STATUS else (),
            skipped=tuple(skipped),
        )
        return SyncEvaluation(summary=summary, work_items=work_items)

    def active_since(self, request: SyncSelectionRequest, now: datetime) -> datetime:
        state = self.state_store.read()
        if state.last_completed_at is not None:
            return state.last_completed_at
        return now - request.interval

    def selected_repositories(
        self,
        request: SyncSelectionRequest,
    ) -> tuple[Repository, ...]:
        if request.repository_name is None:
            return tuple(self.repositories.list())
        repository = self.repositories.select_by_name(
            SelectRepositoryRequest(name=request.repository_name)
        )
        return (repository,)


def transcript_sort_key(candidate: TranscriptCandidate) -> tuple[str, str, str]:
    return (
        candidate.app.value,
        candidate.session_id,
        candidate.transcript_path.as_posix(),
    )

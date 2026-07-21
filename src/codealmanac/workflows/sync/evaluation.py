from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.requests import SelectRepositoryRequest
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.service import RunsService
from codealmanac.services.sources.models import TranscriptCandidate
from codealmanac.services.sources.requests import DiscoverTranscriptsRequest
from codealmanac.services.sources.service import SourcesService
from codealmanac.workflows.sync.models import (
    SyncEvaluation,
    SyncMode,
    SyncRepositoryIngest,
    SyncSkipped,
    SyncSummary,
)
from codealmanac.workflows.sync.requests import SyncSelectionRequest
from codealmanac.workflows.sync.store import SyncStateStore
from codealmanac.workflows.sync.summary import (
    ready_sync_repository,
    skipped_transcript,
)


class SyncEvaluator:
    def __init__(
        self,
        repositories: RepositoriesService,
        sources: SourcesService,
        runs: RunsService,
        state_store: SyncStateStore,
    ):
        self.repositories = repositories
        self.sources = sources
        self.runs = runs
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
        owned_sessions_by_repository_id = {
            repository.repository_id: self.owned_sessions(repository)
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
            if (
                transcript.app.value,
                transcript.session_id,
            ) in owned_sessions_by_repository_id[repository.repository_id]:
                skipped.append(skipped_transcript(transcript, "codealmanac-run"))
                continue
            transcripts_by_repository_id[repository.repository_id].append(transcript)

        repository_ingests = tuple(
            SyncRepositoryIngest(
                repository=repositories_by_id[repository_id],
                transcripts=tuple(sorted(transcripts, key=transcript_sort_key)),
            )
            for repository_id, transcripts in sorted(
                transcripts_by_repository_id.items()
            )
        )
        ready = tuple(ready_sync_repository(item) for item in repository_ingests)
        summary = SyncSummary(
            mode=mode,
            since=active_since,
            scanned=len(transcripts),
            eligible=sum(len(item.transcripts) for item in repository_ingests),
            ready=ready if mode == SyncMode.STATUS else (),
            skipped=tuple(skipped),
        )
        return SyncEvaluation(summary=summary, repository_ingests=repository_ingests)

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

    def owned_sessions(self, repository: Repository) -> frozenset[tuple[str, str]]:
        return frozenset(
            (transcript.kind.value, transcript.session_id)
            for transcript in self.runs.list_harness_transcripts(
                repository.repository_id
            )
        )


def transcript_sort_key(candidate: TranscriptCandidate) -> tuple[str, str, str]:
    return (
        candidate.app.value,
        candidate.session_id,
        candidate.transcript_path.as_posix(),
    )

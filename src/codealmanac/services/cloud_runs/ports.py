from typing import Protocol
from uuid import UUID

from codealmanac.services.cloud_runs.models import (
    CloudRun,
    CloudRunEvent,
    CloudRunPage,
)


class CloudRunsClient(Protocol):
    def list_repository_runs(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> CloudRunPage:
        pass

    def start_repository_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        repo_id: int,
        branch: str,
    ) -> CloudRun:
        pass

    def read_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        pass

    def cancel_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        pass

    def retry_run(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> CloudRun:
        pass

    def list_run_events(
        self,
        *,
        api_url: str,
        cli_token: str,
        run_id: UUID,
    ) -> tuple[CloudRunEvent, ...]:
        pass

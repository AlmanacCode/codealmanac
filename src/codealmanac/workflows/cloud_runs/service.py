from codealmanac.services.cloud_runs.requests import (
    CancelCloudRunRequest,
    ListCloudRunEventsRequest,
    ListCloudRunsForRepoRequest,
    ReadCloudRunRequest,
    RetryCloudRunRequest,
    StartCloudRunForRepoRequest,
)
from codealmanac.services.cloud_runs.service import CloudRunsService
from codealmanac.workflows.cloud_repo.requests import ReadCloudRepoStatusRequest
from codealmanac.workflows.cloud_repo.service import (
    CloudRepoWorkflow,
    unavailable_checkout,
)
from codealmanac.workflows.cloud_runs.models import (
    CloudRunDetailResult,
    CloudRunListResult,
    CloudRunLogResult,
)
from codealmanac.workflows.cloud_runs.requests import (
    CancelCloudRunWorkflowRequest,
    ListCloudRunsRequest,
    ReadCloudRunLogRequest,
    RetryCloudRunWorkflowRequest,
    ShowCloudRunRequest,
    StartCloudRunRequest,
)


class CloudRunsWorkflow:
    def __init__(
        self,
        cloud_runs: CloudRunsService,
        cloud_repo: CloudRepoWorkflow,
    ):
        self.cloud_runs = cloud_runs
        self.cloud_repo = cloud_repo

    def list(self, request: ListCloudRunsRequest) -> CloudRunListResult:
        status = self.cloud_repo.status(
            ReadCloudRepoStatusRequest(cwd=request.cwd, api_url=request.api_url)
        )
        if status.repository is None:
            raise unavailable_checkout(status)
        page = self.cloud_runs.list_for_repo(
            ListCloudRunsForRepoRequest(
                api_url=request.api_url,
                repo_id=status.repository.repo_id,
                limit=request.limit,
                cursor=request.cursor,
            )
        )
        return CloudRunListResult(status=status, page=page)

    def start(self, request: StartCloudRunRequest) -> CloudRunDetailResult:
        status = self.cloud_repo.status(
            ReadCloudRepoStatusRequest(cwd=request.cwd, api_url=request.api_url)
        )
        if status.repository is None:
            raise unavailable_checkout(status)
        run = self.cloud_runs.start_for_repo(
            StartCloudRunForRepoRequest(
                api_url=request.api_url,
                repo_id=status.repository.repo_id,
                branch=request.branch,
            )
        )
        return CloudRunDetailResult(run=run)

    def show(self, request: ShowCloudRunRequest) -> CloudRunDetailResult:
        run = self.cloud_runs.read(
            ReadCloudRunRequest(api_url=request.api_url, run_id=request.run_id)
        )
        return CloudRunDetailResult(run=run)

    def cancel(self, request: CancelCloudRunWorkflowRequest) -> CloudRunDetailResult:
        run = self.cloud_runs.cancel(
            CancelCloudRunRequest(api_url=request.api_url, run_id=request.run_id)
        )
        return CloudRunDetailResult(run=run)

    def retry(self, request: RetryCloudRunWorkflowRequest) -> CloudRunDetailResult:
        run = self.cloud_runs.retry(
            RetryCloudRunRequest(api_url=request.api_url, run_id=request.run_id)
        )
        return CloudRunDetailResult(run=run)

    def log(self, request: ReadCloudRunLogRequest) -> CloudRunLogResult:
        events = self.cloud_runs.list_events(
            ListCloudRunEventsRequest(api_url=request.api_url, run_id=request.run_id)
        )
        return CloudRunLogResult(run_id=request.run_id, events=events)

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.cloud_auth.models import CloudStatus
from codealmanac.services.cloud_capture.models import CaptureStatus
from codealmanac.workflows.cloud_repo.models import CloudRepoStatusResult


class CloudStatusOverview(CodeAlmanacModel):
    auth: CloudStatus
    repo: CloudRepoStatusResult | None = None
    capture: CaptureStatus

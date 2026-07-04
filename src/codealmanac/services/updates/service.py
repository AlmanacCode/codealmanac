from codealmanac.services.updates.models import (
    PACKAGE_NAME,
    PackageInstallMetadata,
    UpdateInstallMethod,
    UpdatePlan,
    UpdateResult,
    UpdateStatus,
)
from codealmanac.services.updates.ports import (
    PackageCommandRunner,
    PackageInstallMetadataProvider,
)
from codealmanac.services.updates.requests import CheckUpdateRequest, RunUpdateRequest


class UpdatesService:
    def __init__(
        self,
        metadata: PackageInstallMetadataProvider,
        runner: PackageCommandRunner,
    ):
        self.metadata = metadata
        self.runner = runner

    def check(self, request: CheckUpdateRequest) -> UpdatePlan:
        return plan_update(self.metadata.read())

    def run(self, request: RunUpdateRequest) -> UpdateResult:
        plan = self.check(CheckUpdateRequest())
        if plan.status != UpdateStatus.READY:
            return UpdateResult(status=plan.status, plan=plan)
        output = self.runner.run(plan.command)
        status = (
            UpdateStatus.COMPLETED if output.exit_code == 0 else UpdateStatus.FAILED
        )
        return UpdateResult(
            status=status,
            plan=plan,
            exit_code=output.exit_code,
            stdout=output.stdout,
            stderr=output.stderr,
        )


def plan_update(metadata: PackageInstallMetadata) -> UpdatePlan:
    method = update_method(metadata)
    if method == UpdateInstallMethod.EDITABLE:
        return UpdatePlan(
            status=UpdateStatus.UNSUPPORTED,
            method=method,
            installed_version=metadata.version,
            message="editable source install cannot be self-updated",
            fix="run: git pull && uv sync",
            installer=metadata.installer,
            editable=metadata.editable,
            source_url=metadata.source_url,
        )
    if method == UpdateInstallMethod.UV_TOOL:
        command = ("uv", "tool", "upgrade", PACKAGE_NAME)
        return runnable_plan(metadata, method, command)
    if method == UpdateInstallMethod.PIP:
        command = (
            str(metadata.python_executable),
            "-m",
            "pip",
            "install",
            "--upgrade",
            PACKAGE_NAME,
        )
        return runnable_plan(metadata, method, command)
    return UpdatePlan(
        status=UpdateStatus.UNSUPPORTED,
        method=method,
        installed_version=metadata.version,
        message="unknown package installer; refusing automatic update",
        fix=(
            f"run: uv tool upgrade {PACKAGE_NAME} "
            f"or {metadata.python_executable} -m pip install --upgrade {PACKAGE_NAME}"
        ),
        installer=metadata.installer,
        editable=metadata.editable,
        source_url=metadata.source_url,
    )


def runnable_plan(
    metadata: PackageInstallMetadata,
    method: UpdateInstallMethod,
    command: tuple[str, ...],
) -> UpdatePlan:
    return UpdatePlan(
        status=UpdateStatus.READY,
        method=method,
        installed_version=metadata.version,
        command=command,
        message="ready to run foreground package update",
        installer=metadata.installer,
        editable=metadata.editable,
        source_url=metadata.source_url,
    )


def update_method(metadata: PackageInstallMetadata) -> UpdateInstallMethod:
    if metadata.editable:
        return UpdateInstallMethod.EDITABLE
    installer = (metadata.installer or "").strip().casefold()
    if installer == "uv":
        return UpdateInstallMethod.UV_TOOL
    if installer == "pip":
        return UpdateInstallMethod.PIP
    return UpdateInstallMethod.UNKNOWN

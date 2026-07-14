from pathlib import Path

from codealmanac.services.updates.activity import active_run_count
from codealmanac.services.updates.lock import UpdateLockStore
from codealmanac.services.updates.models import (
    PACKAGE_NAME,
    PackageInstallMetadata,
    UpdateInstallMethod,
    UpdatePlan,
    UpdateResult,
    UpdateSmokeResult,
    UpdateStatus,
)
from codealmanac.services.updates.ports import (
    PackageCommandRunner,
    PackageInstallMetadataProvider,
)
from codealmanac.services.updates.requests import CheckUpdateRequest, RunUpdateRequest

SMOKE_COMMANDS = (
    ("codealmanac", "--version"),
    ("codealmanac", "doctor", "--json"),
)


class UpdatesService:
    def __init__(
        self,
        metadata: PackageInstallMetadataProvider,
        runner: PackageCommandRunner,
        lock_path: Path,
        database_path: Path,
        lock_store: UpdateLockStore | None = None,
    ):
        self.metadata = metadata
        self.runner = runner
        self.lock_path = lock_path
        self.database_path = database_path
        self.lock_store = lock_store or UpdateLockStore()

    def check(self, request: CheckUpdateRequest) -> UpdatePlan:
        return plan_update(self.metadata.read())

    def run(self, request: RunUpdateRequest) -> UpdateResult:
        plan = self.check(CheckUpdateRequest())
        if request.scheduled:
            return self.run_scheduled(request, plan)
        if plan.status != UpdateStatus.READY:
            return UpdateResult(status=plan.status, plan=plan)
        return self.run_plan(plan, smoke=False)

    def run_scheduled(
        self,
        request: RunUpdateRequest,
        plan: UpdatePlan,
    ) -> UpdateResult:
        if plan.status != UpdateStatus.READY:
            return UpdateResult(
                status=UpdateStatus.SKIPPED,
                plan=plan,
                message=f"scheduled update skipped: {plan.message}",
            )
        lease = self.lock_store.acquire(self.lock_path)
        if lease is None:
            return UpdateResult(
                status=UpdateStatus.SKIPPED,
                plan=plan,
                message="scheduled update skipped: update already in progress",
            )
        try:
            active = active_run_count(self.database_path)
            if active > 0:
                return UpdateResult(
                    status=UpdateStatus.SKIPPED,
                    plan=plan,
                    message=active_runs_message(active),
                )
            return self.run_plan(plan, smoke=True)
        finally:
            lease.release()

    def run_plan(self, plan: UpdatePlan, smoke: bool) -> UpdateResult:
        output = self.runner.run(plan.command)
        status = (
            UpdateStatus.COMPLETED if output.exit_code == 0 else UpdateStatus.FAILED
        )
        smoke_results: tuple[UpdateSmokeResult, ...] = ()
        if status == UpdateStatus.COMPLETED and smoke:
            smoke_results = self.run_smoke()
            if any(result.exit_code != 0 for result in smoke_results):
                status = UpdateStatus.FAILED
        return UpdateResult(
            status=status,
            plan=plan,
            exit_code=output.exit_code,
            stdout=output.stdout,
            stderr=output.stderr,
            smoke=smoke_results,
        )

    def run_smoke(self) -> tuple[UpdateSmokeResult, ...]:
        results: list[UpdateSmokeResult] = []
        for command in SMOKE_COMMANDS:
            output = self.runner.run(command)
            results.append(
                UpdateSmokeResult(
                    command=command,
                    exit_code=output.exit_code,
                    stdout=output.stdout,
                    stderr=output.stderr,
                )
            )
        return tuple(results)


def active_runs_message(active: int) -> str:
    suffix = "job is" if active == 1 else "jobs are"
    return f"scheduled update skipped: {active} CodeAlmanac {suffix} active"


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
        message="ready to run package update",
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

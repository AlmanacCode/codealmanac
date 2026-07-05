from codealmanac.diagnostics.models import DoctorCheck, DoctorStatus
from codealmanac.engine.harnesses.models import HarnessReadiness
from codealmanac.engine.harnesses.service import HarnessesService


def harness_checks(harnesses: HarnessesService) -> tuple[DoctorCheck, ...]:
    return tuple(harness_check(readiness) for readiness in harnesses.check())


def harness_check(readiness: HarnessReadiness) -> DoctorCheck:
    return DoctorCheck(
        key=f"harness.{readiness.kind.value}",
        status=DoctorStatus.OK if readiness.available else DoctorStatus.PROBLEM,
        message=f"{readiness.kind.value}: {readiness.message}",
        fix=None if readiness.available else "run provider login or setup",
    )

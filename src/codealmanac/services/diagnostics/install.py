from pathlib import Path

from codealmanac.core.errors import CodeAlmanacError
from codealmanac.manual import ManualLibrary
from codealmanac.services.diagnostics.messages import first_line
from codealmanac.services.diagnostics.models import (
    DoctorCheck,
    DoctorStatus,
)


def install_checks(
    *,
    version: str,
    database_path: Path,
    manual: ManualLibrary,
    python_version: str,
    python_supported: bool,
) -> tuple[DoctorCheck, ...]:
    return (
        DoctorCheck(
            key="install.version",
            status=DoctorStatus.OK,
            message=f"codealmanac {version}",
        ),
        DoctorCheck(
            key="install.python",
            status=DoctorStatus.OK if python_supported else DoctorStatus.PROBLEM,
            message=f"python {python_version}",
            fix=None if python_supported else "install Python 3.12 or newer",
        ),
        DoctorCheck(
            key="install.database",
            status=DoctorStatus.INFO,
            message=f"database: {database_path}",
        ),
        manual_package_check(manual),
    )


def manual_package_check(manual: ManualLibrary) -> DoctorCheck:
    try:
        inventory = manual.inventory()
    except CodeAlmanacError as error:
        return DoctorCheck(
            key="install.manual",
            status=DoctorStatus.PROBLEM,
            message=f"manual package unavailable: {first_line(str(error))}",
            fix="reinstall codealmanac",
        )
    return DoctorCheck(
        key="install.manual",
        status=DoctorStatus.OK,
        message=f"manual: {len(inventory.documents)} bundled docs",
    )

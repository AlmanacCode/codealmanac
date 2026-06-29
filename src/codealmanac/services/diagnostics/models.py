from enum import StrEnum

from codealmanac.core.models import CodeAlmanacModel


class DoctorStatus(StrEnum):
    OK = "ok"
    INFO = "info"
    PROBLEM = "problem"


class DoctorCheck(CodeAlmanacModel):
    key: str
    status: DoctorStatus
    message: str
    fix: str | None = None


class DoctorReport(CodeAlmanacModel):
    version: str
    install: tuple[DoctorCheck, ...]
    wiki: tuple[DoctorCheck, ...]

import platform
import sys

from codealmanac.manual import ManualLibrary
from codealmanac.services.diagnostics.install import install_checks
from codealmanac.services.diagnostics.models import DoctorReport
from codealmanac.services.diagnostics.requests import DoctorRequest
from codealmanac.services.diagnostics.wiki import wiki_checks
from codealmanac.services.index.service import IndexService
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.settings import LocalStatePaths


class DiagnosticsService:
    def __init__(
        self,
        repositories: RepositoriesService,
        index: IndexService,
        manual: ManualLibrary,
        local_state: LocalStatePaths,
        version: str,
        python_version: str | None = None,
        python_supported: bool | None = None,
    ):
        self.repositories = repositories
        self.index = index
        self.manual = manual
        self.local_state = local_state
        self.version = version
        self.python_version = python_version or platform.python_version()
        if python_supported is None:
            self.python_supported = sys.version_info >= (3, 12)
        else:
            self.python_supported = python_supported

    def check(self, request: DoctorRequest) -> DoctorReport:
        return DoctorReport(
            version=self.version,
            install=install_checks(
                version=self.version,
                database_path=self.local_state.database_path,
                manual=self.manual,
                python_version=self.python_version,
                python_supported=self.python_supported,
            ),
            wiki=wiki_checks(
                request,
                repositories=self.repositories,
                index=self.index,
            ),
        )

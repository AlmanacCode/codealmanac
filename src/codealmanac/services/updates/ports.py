from typing import Protocol

from codealmanac.services.updates.models import (
    PackageCommandResult,
    PackageInstallMetadata,
)


class PackageInstallMetadataProvider(Protocol):
    def read(self) -> PackageInstallMetadata:
        """Return metadata for the currently running package installation."""


class PackageCommandRunner(Protocol):
    def run(self, command: tuple[str, ...]) -> PackageCommandResult:
        """Run a foreground package-manager command."""

from importlib.resources import files
from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.manual.models import (
    MANUAL_DOCUMENTS,
    ManualDocument,
    ManualInstallResult,
    ManualInventory,
    ManualRepositoryStatus,
)
from codealmanac.manual.requests import ManualReadRequest

MANUAL_PACKAGE = "codealmanac.manual"


class ManualLibrary:
    def inventory(self) -> ManualInventory:
        return ManualInventory(
            documents=tuple(
                self.read(ManualReadRequest(document=document))
                for document in MANUAL_DOCUMENTS
            )
        )

    def read(self, request: ManualReadRequest) -> ManualDocument:
        resource = files(MANUAL_PACKAGE).joinpath(request.document.value)
        try:
            body = resource.read_text(encoding="utf-8")
        except (FileNotFoundError, OSError) as error:
            raise ValidationFailed(
                f"cannot read bundled manual document {request.document.value}: {error}"
            ) from error
        return ManualDocument(
            name=request.document,
            relative_path=request.document.value,
            body=body,
        )

    def install_missing(self, target_path: Path) -> ManualInstallResult:
        try:
            target_path.mkdir(parents=True, exist_ok=True)
            copied: list[str] = []
            existing: list[str] = []
            for document in MANUAL_DOCUMENTS:
                destination = target_path / document.value
                if destination.exists():
                    existing.append(document.value)
                    continue
                source = files(MANUAL_PACKAGE).joinpath(document.value)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(source.read_bytes())
                copied.append(document.value)
        except OSError as error:
            raise ValidationFailed(f"cannot install manual files: {error}") from error
        return ManualInstallResult(
            target_path=target_path,
            copied=tuple(copied),
            existing=tuple(existing),
        )

    def repository_status(self, target_path: Path) -> ManualRepositoryStatus:
        expected = tuple(document.value for document in MANUAL_DOCUMENTS)
        present: list[str] = []
        changed: list[str] = []
        try:
            for document in MANUAL_DOCUMENTS:
                repository_file = target_path / document.value
                if not repository_file.is_file():
                    continue
                present.append(document.value)
                bundled = files(MANUAL_PACKAGE).joinpath(document.value).read_bytes()
                if repository_file.read_bytes() != bundled:
                    changed.append(document.value)
        except OSError as error:
            raise ValidationFailed(f"cannot inspect manual files: {error}") from error
        missing = tuple(document for document in expected if document not in present)
        return ManualRepositoryStatus(
            target_path=target_path,
            expected=expected,
            present=tuple(present),
            missing=missing,
            changed=tuple(changed),
        )

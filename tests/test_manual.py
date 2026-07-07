from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.manual import (
    ManualDocumentName,
    ManualLibrary,
    ManualReadRequest,
)


def test_manual_library_reads_all_bundled_documents():
    inventory = ManualLibrary().inventory()

    names = tuple(document.name for document in inventory.documents)
    assert names == tuple(ManualDocumentName)
    assert all(
        document.body.strip().startswith("---") for document in inventory.documents
    )
    assert "The only repo wiki root is `almanac/`" in ManualLibrary().read(
        ManualReadRequest(document=ManualDocumentName.README)
    ).body
    assert "Use normal Markdown links for wiki pages" in ManualLibrary().read(
        ManualReadRequest(document=ManualDocumentName.LINKS)
    ).body
    assert "Use this manual when writing a page under `almanac/architecture/`" in (
        ManualLibrary().read(
            ManualReadRequest(document=ManualDocumentName.ARCHITECTURE)
        ).body
    )


def test_manual_read_request_requires_known_document():
    with pytest.raises(ValidationError):
        ManualReadRequest(document="unknown.md")


def test_manual_install_missing_preserves_existing_files(tmp_path: Path):
    target = tmp_path / "manual"
    target.mkdir()
    existing = target / "README.md"
    existing.write_text("local edit\n", encoding="utf-8")

    result = ManualLibrary().install_missing(target)

    assert existing.read_text(encoding="utf-8") == "local edit\n"
    assert "README.md" in result.existing
    assert "how-to-write.md" in result.copied
    assert "links.md" in result.copied
    assert (target / "ingest.md").is_file()
    assert ManualLibrary().repository_status(target).complete


def test_manual_repository_status_reports_changed_files(tmp_path: Path):
    target = tmp_path / "manual"
    ManualLibrary().install_missing(target)
    (target / "README.md").write_text("local manual edit\n", encoding="utf-8")

    status = ManualLibrary().repository_status(target)

    assert status.complete
    assert status.changed == ("README.md",)

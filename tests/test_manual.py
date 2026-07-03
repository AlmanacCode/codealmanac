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
    assert "configured Almanac root" in ManualLibrary().read(
        ManualReadRequest(document=ManualDocumentName.README)
    ).body
    assert "compact summary of the whole" in ManualLibrary().read(
        ManualReadRequest(document=ManualDocumentName.HOW_TO_WRITE)
    ).body
    assert "Use links to make the wiki a graph" in ManualLibrary().read(
        ManualReadRequest(document=ManualDocumentName.LINKS)
    ).body
    assert "easy to query and browse" in ManualLibrary().read(
        ManualReadRequest(document=ManualDocumentName.TOPICS)
    ).body


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
    assert "topics.md" in result.copied
    assert (target / "architecture.md").is_file()
    assert (target / "ingest.md").is_file()
    assert ManualLibrary().workspace_status(target).complete


def test_manual_workspace_status_reports_changed_files(tmp_path: Path):
    target = tmp_path / "manual"
    ManualLibrary().install_missing(target)
    (target / "README.md").write_text("local manual edit\n", encoding="utf-8")

    status = ManualLibrary().workspace_status(target)

    assert status.complete
    assert status.changed == ("README.md",)

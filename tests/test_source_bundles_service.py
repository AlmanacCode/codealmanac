import json
from pathlib import Path

import pytest

from codealmanac.core.errors import ValidationFailed
from codealmanac.services.source_bundles.models import SourceBundleSessionInput
from codealmanac.services.source_bundles.requests import MaterializeSourceBundleRequest
from codealmanac.services.source_bundles.service import SourceBundlesService
from codealmanac.services.source_bundles.store import SourceBundlesStore


def test_source_bundle_materializes_session_files_and_manifest(tmp_path: Path):
    service = SourceBundlesService(SourceBundlesStore())
    transcript = tmp_path / "codex-session.jsonl"
    transcript.write_text('{"message":"hello"}\n', encoding="utf-8")
    target = tmp_path / "sources"

    bundle = service.materialize(
        MaterializeSourceBundleRequest(
            run_id="run_123",
            branch_id="branch_123",
            target_path=target,
            sessions=(
                SourceBundleSessionInput(
                    session_id="session_123",
                    provider="codex",
                    provider_session_id="codex-1",
                    source_ref=transcript.as_uri(),
                ),
            ),
        )
    )

    copied = target / "sessions/codex/session_123.jsonl"
    manifest = json.loads(bundle.manifest_path.read_text(encoding="utf-8"))

    assert bundle.root_path == target
    assert bundle.session_count == 1
    assert copied.read_text(encoding="utf-8") == '{"message":"hello"}\n'
    assert manifest["run_id"] == "run_123"
    assert manifest["branch_id"] == "branch_123"
    assert manifest["sessions"] == [
        {
            "session_id": "session_123",
            "provider": "codex",
            "provider_session_id": "codex-1",
            "source_ref": transcript.as_uri(),
            "path": "sessions/codex/session_123.jsonl",
        }
    ]


def test_source_bundle_fails_for_missing_session_file(tmp_path: Path):
    service = SourceBundlesService(SourceBundlesStore())

    with pytest.raises(ValidationFailed, match="session source file is unavailable"):
        service.materialize(
            MaterializeSourceBundleRequest(
                run_id="run_123",
                branch_id="branch_123",
                target_path=tmp_path / "sources",
                sessions=(
                    SourceBundleSessionInput(
                        session_id="session_123",
                        provider="codex",
                        provider_session_id="codex-1",
                        source_ref=(tmp_path / "missing.jsonl").as_uri(),
                    ),
                ),
            )
        )

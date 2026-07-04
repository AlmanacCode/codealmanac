import shutil
from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import uuid4

from codealmanac.core.errors import ValidationFailed
from codealmanac.engine.source_bundles.models import (
    MaterializedSourceBundle,
    SourceBundleManifest,
    SourceBundleSessionFile,
    SourceBundleSessionInput,
)
from codealmanac.engine.source_bundles.requests import (
    MaterializeSourceBundleRequest,
)

MANIFEST_FILE_NAME = "manifest.json"
SESSIONS_DIR_NAME = "sessions"
DEFAULT_SESSION_SUFFIX = ".jsonl"


class SourceBundlesStore:
    def materialize(
        self,
        request: MaterializeSourceBundleRequest,
    ) -> MaterializedSourceBundle:
        root_path = request.target_path
        sessions_path = root_path / SESSIONS_DIR_NAME
        sessions_path.mkdir(parents=True, exist_ok=True)
        files = tuple(
            self.copy_session(root_path, sessions_path, session)
            for session in request.sessions
        )
        manifest = SourceBundleManifest(
            run_id=request.run_id,
            branch_id=request.branch_id,
            sessions=files,
        )
        manifest_path = root_path / MANIFEST_FILE_NAME
        write_json_atomically(manifest_path, manifest.model_dump_json(indent=2))
        return MaterializedSourceBundle(
            root_path=root_path,
            manifest_path=manifest_path,
            sessions_path=sessions_path,
            manifest=manifest,
        )

    def copy_session(
        self,
        root_path: Path,
        sessions_path: Path,
        session: SourceBundleSessionInput,
    ) -> SourceBundleSessionFile:
        source_path = source_ref_path(session.source_ref)
        if not source_path.is_file():
            raise ValidationFailed(f"session source file is unavailable: {source_path}")
        suffix = source_path.suffix or DEFAULT_SESSION_SUFFIX
        destination = sessions_path / session.provider / f"{session.session_id}{suffix}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, destination)
        return SourceBundleSessionFile(
            session_id=session.session_id,
            provider=session.provider,
            provider_session_id=session.provider_session_id,
            source_ref=session.source_ref,
            path=destination.relative_to(root_path),
        )


def source_ref_path(source_ref: str) -> Path:
    parsed = urlparse(source_ref)
    if parsed.scheme == "file":
        return Path(unquote(parsed.path))
    if parsed.scheme == "":
        return Path(source_ref).expanduser()
    raise ValidationFailed(f"unsupported session source ref scheme: {parsed.scheme}")


def write_json_atomically(path: Path, payload: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(payload, encoding="utf-8")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()

import json
import os
from pathlib import Path

from pydantic import ValidationError

from codealmanac.cloud.capture.models import CaptureState
from codealmanac.core.errors import ValidationFailed


class CaptureStateStore:
    def __init__(self, path: Path):
        self.path = path

    def load(self) -> CaptureState | None:
        if not self.path.exists():
            return None
        try:
            return CaptureState.model_validate_json(
                self.path.read_text(encoding="utf-8")
            )
        except (OSError, ValidationError, json.JSONDecodeError) as error:
            raise ValidationFailed(f"invalid capture state: {error}") from error

    def save(self, state: CaptureState) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = state.model_dump_json(indent=2)
        temp_path = self.path.with_suffix(self.path.suffix + ".tmp")
        fd = os.open(temp_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(payload)
                handle.write("\n")
            os.replace(temp_path, self.path)
            os.chmod(self.path, 0o600)
        finally:
            if temp_path.exists():
                temp_path.unlink()

    def delete(self) -> None:
        try:
            self.path.unlink()
        except FileNotFoundError:
            return

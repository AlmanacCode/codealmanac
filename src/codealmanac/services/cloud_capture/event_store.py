import json
from pathlib import Path

from codealmanac.services.cloud_capture.models import CaptureHookEvent


class CaptureEventStore:
    def __init__(self, path: Path):
        self.path = path

    def append(self, event: CaptureHookEvent) -> Path:
        self.path.mkdir(parents=True, exist_ok=True)
        event_path = self.path / "events.jsonl"
        with event_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event.model_dump(mode="json"), sort_keys=True))
            handle.write("\n")
        return event_path


from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text
from codealmanac.engine.harnesses.models import HarnessEvent, HarnessKind
from codealmanac.engine.page_run.models import PageRunContext
from codealmanac.jobs.ledger.models import JobEventKind, JobId


class PageRunBeginRequest(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    wiki: str | None = None


class PageJobRecordEventRequest(CodeAlmanacModel):
    context: PageRunContext
    kind: JobEventKind
    message: str
    harness_event: HarnessEvent | None = None

    @field_validator("message")
    @classmethod
    def require_message(cls, value: str) -> str:
        return required_text(value, "page run event message")


class PageRunExecuteRequest(CodeAlmanacModel):
    context: PageRunContext
    harness: HarnessKind
    prompt: str
    title: str | None = None
    success_summary: str

    @field_validator("prompt", "success_summary")
    @classmethod
    def require_text(cls, value: str) -> str:
        return required_text(value, "page run request text")

    @field_validator("title")
    @classmethod
    def require_optional_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return required_text(value, "page run title")

from typing import Literal
from uuid import UUID

from pydantic import model_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.config.models import HARNESS_MODELS
from codealmanac.services.harnesses.models import HarnessKind

type TelemetryValue = (
    str
    | int
    | float
    | bool
    | None
    | list["TelemetryValue"]
    | dict[str, "TelemetryValue"]
)

type CommandName = Literal[
    "init",
    "ingest",
    "garden",
    "sync",
    "list",
    "search",
    "show",
    "topics",
    "health",
    "validate",
    "reindex",
    "serve",
    "tag",
    "untag",
    "config",
    "setup",
    "uninstall",
    "doctor",
    "update",
    "jobs",
    "automation",
]
type CommandAction = Literal[
    "init",
    "ingest",
    "garden",
    "run",
    "status",
    "list",
    "search",
    "show",
    "create",
    "describe",
    "link",
    "unlink",
    "rename",
    "delete",
    "health",
    "validate",
    "reindex",
    "serve",
    "tag",
    "untag",
    "get",
    "set",
    "apply",
    "setup",
    "uninstall",
    "doctor",
    "check",
    "scheduled",
    "logs",
    "attach",
    "cancel",
]
type DurationBucket = Literal[
    "<250ms", "250ms-1s", "1-10s", "10-60s", "1-5m", "5m+"
]


class CliCommandCompletedProperties(CodeAlmanacModel):
    command: CommandName
    action: CommandAction
    outcome: Literal["success", "failed", "crashed", "interrupted"]
    exit_code: int
    duration_bucket: DurationBucket
    interactive: bool


class LifecycleRunCompletedProperties(CodeAlmanacModel):
    run_kind: Literal["build", "ingest", "garden"]
    status: Literal["done", "failed", "cancelled"]
    harness: Literal["codex", "claude"]
    model: str
    duration_bucket: DurationBucket
    failure_category: Literal[
        "harness_readiness",
        "provider_execution",
        "source_preparation",
        "mutation_safety",
        "wiki_validation",
        "indexing",
        "internal_error",
    ] | None = None

    @model_validator(mode="after")
    def validate_lifecycle_contract(self) -> "LifecycleRunCompletedProperties":
        if self.model not in HARNESS_MODELS[HarnessKind(self.harness)]:
            raise ValueError("model is not controlled for harness")
        if self.status == "failed" and self.failure_category is None:
            raise ValueError("failed lifecycle events require failure_category")
        if self.status != "failed" and self.failure_category is not None:
            raise ValueError("only failed lifecycle events have failure_category")
        return self


class TelemetryIdentity(CodeAlmanacModel):
    installation_id: UUID
    distinct_id: str
    kind: Literal["anonymous", "authenticated"]


class TelemetryEvent(CodeAlmanacModel):
    event_id: str
    name: str
    identity: TelemetryIdentity
    properties: dict[str, TelemetryValue]

    @model_validator(mode="after")
    def only_allow_event_properties(self) -> "TelemetryEvent":
        common = {
            "cli_version",
            "identity_kind",
            "os_family",
            "os_major",
            "architecture",
            "python_version",
            "$geoip_disable",
        }
        specific = {
            "cli command completed": set(CliCommandCompletedProperties.model_fields),
            "lifecycle run completed": set(
                LifecycleRunCompletedProperties.model_fields
            ),
            "$exception": {
                "$exception_list",
                "$exception_fingerprint",
                "$exception_type",
                "$exception_message",
                "command",
                "process_kind",
            },
        }
        if self.name not in specific:
            raise ValueError(f"unsupported telemetry event: {self.name}")
        unexpected = set(self.properties) - common - specific[self.name]
        if unexpected:
            raise ValueError(
                f"unsupported {self.name} properties: {', '.join(sorted(unexpected))}"
            )
        missing_common = common - set(self.properties)
        if missing_common:
            raise ValueError(
                f"missing common telemetry properties: "
                f"{', '.join(sorted(missing_common))}"
            )
        event_properties = {
            key: self.properties[key]
            for key in specific[self.name]
            if key in self.properties
        }
        if self.name == "cli command completed":
            CliCommandCompletedProperties.model_validate(event_properties)
        elif self.name == "lifecycle run completed":
            LifecycleRunCompletedProperties.model_validate(event_properties)
        else:
            missing = specific[self.name] - set(event_properties)
            if missing:
                raise ValueError(
                    f"missing exception properties: {', '.join(sorted(missing))}"
                )
        return self

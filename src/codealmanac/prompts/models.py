from enum import StrEnum


class PromptName(StrEnum):
    BASE_KERNEL = "base/kernel.md"
    OPERATION_INIT = "operations/init.md"
    OPERATION_INGEST = "operations/ingest.md"
    OPERATION_GARDEN = "operations/garden.md"
    OPERATION_UPDATE = "operations/update.md"

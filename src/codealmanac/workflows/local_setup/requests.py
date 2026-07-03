from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.control.models import (
    ControlDeliveryMode,
)
from codealmanac.wiki.workspaces.roots import (
    DEFAULT_ALMANAC_ROOT,
    validate_almanac_root_field,
)


class RunLocalSetupRequest(CodeAlmanacModel):
    cwd: Path
    branch_name: str | None = None
    almanac_root: Path = DEFAULT_ALMANAC_ROOT
    delivery_mode: ControlDeliveryMode = ControlDeliveryMode.COMMIT
    install_hooks: bool = True

    @field_validator("almanac_root")
    @classmethod
    def validate_root(cls, value: Path) -> Path:
        return validate_almanac_root_field(value)

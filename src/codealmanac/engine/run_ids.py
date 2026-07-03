from typing import Annotated

from pydantic import StringConstraints

ENGINE_RUN_ID_PATTERN = r"^[A-Za-z0-9_-]+$"
EngineRunId = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        pattern=ENGINE_RUN_ID_PATTERN,
    ),
]

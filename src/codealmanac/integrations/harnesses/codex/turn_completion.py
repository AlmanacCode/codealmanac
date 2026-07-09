from codealmanac.integrations.harnesses.codex.state import CodexRunState
from codealmanac.integrations.harnesses.fields import (
    JsonObject,
    as_record,
    string_field,
)


def root_turn_completion(message: JsonObject, state: CodexRunState) -> bool:
    if string_field(message, "method") != "turn/completed":
        return False
    params = as_record(message.get("params"))
    completed_turn_id = string_field(params, "turnId")
    completed_thread_id = string_field(params, "threadId")
    return (
        state.root_turn_id is not None
        and completed_turn_id == state.root_turn_id
    ) or (
        state.root_thread_id is not None
        and completed_thread_id == state.root_thread_id
    )

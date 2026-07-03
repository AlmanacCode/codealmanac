from codealmanac.engine.runs.models import EngineRunRequest
from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest

UPDATE_PROMPT_SECTIONS = (
    PromptName.BASE_KERNEL,
    PromptName.OPERATION_UPDATE,
)


def render_update_prompt(
    prompts: PromptRenderer,
    request: EngineRunRequest,
) -> str:
    return prompts.render(
        RenderPromptRequest(
            sections=UPDATE_PROMPT_SECTIONS,
            context=(
                "Runtime context:\n"
                f"{request.model_dump_json(indent=2)}\n",
            ),
        )
    )

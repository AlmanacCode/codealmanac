from codealmanac.engine.runs.models import EngineRunRequest
from codealmanac.local.runs.kinds import LocalRunKind
from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest

UPDATE_PROMPT_SECTIONS = (
    PromptName.BASE_PURPOSE,
    PromptName.BASE_NOTABILITY,
    PromptName.BASE_SYNTAX,
    PromptName.OPERATION_UPDATE,
)
GARDEN_PROMPT_SECTIONS = (
    PromptName.BASE_KERNEL,
    PromptName.OPERATION_GARDEN,
)


def render_update_prompt(
    prompts: PromptRenderer,
    request: EngineRunRequest,
    guidance: str | None = None,
) -> str:
    sections = operation_prompt_sections(request.operation)
    context = (
        "Runtime context:\n"
        f"{request.model_dump_json(indent=2)}\n",
    )
    if guidance is not None:
        context = (*context, f"\n\nUser guidance:\n{guidance}\n")
    return prompts.render(
        RenderPromptRequest(
            sections=sections,
            context=context,
        )
    )


def operation_prompt_sections(operation: str) -> tuple[PromptName, ...]:
    if operation == LocalRunKind.UPDATE.value:
        return UPDATE_PROMPT_SECTIONS
    if operation == LocalRunKind.GARDEN.value:
        return GARDEN_PROMPT_SECTIONS
    raise ValueError(f"unsupported local run kind: {operation}")

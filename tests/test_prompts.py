import pytest
from pydantic import ValidationError

from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest


def test_prompt_renderer_composes_packaged_sections_with_context():
    prompt = PromptRenderer().render(
        RenderPromptRequest(
            sections=(
                PromptName.BASE_KERNEL,
                PromptName.OPERATION_GARDEN,
            ),
            context=("Runtime context:\n{}",),
        )
    )

    assert "CodeAlmanac Kernel" in prompt
    assert "Garden Operation" in prompt
    assert "Runtime context:" in prompt
    assert "\n\n---\n\n" in prompt
    assert "future coding agents" in prompt
    assert "durable knowledge" in prompt
    assert "[[page-slug]]" in prompt


def test_prompt_inventory_reads_init_ingest_garden_and_update_operations():
    rendered = {
        name: PromptRenderer().render(RenderPromptRequest(sections=(name,)))
        for name in PromptName
    }

    assert "Init Operation" in rendered[PromptName.OPERATION_INIT]
    assert "Phase 1: Scan And Plan" in rendered[PromptName.OPERATION_INIT]
    assert "Ingest Operation" in rendered[PromptName.OPERATION_INGEST]
    assert "Garden Operation" in rendered[PromptName.OPERATION_GARDEN]
    assert "Update Operation" in rendered[PromptName.OPERATION_UPDATE]
    assert "CodeAlmanac Kernel" in rendered[PromptName.BASE_KERNEL]


def test_prompt_renderer_requires_sections():
    with pytest.raises(ValidationError):
        RenderPromptRequest(sections=())


def test_prompt_renderer_rejects_blank_context():
    with pytest.raises(ValidationError):
        RenderPromptRequest(
            sections=(PromptName.BASE_KERNEL,),
            context=(" ",),
        )

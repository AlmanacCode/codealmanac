import pytest
from pydantic import ValidationError

from codealmanac.prompts import PromptName, PromptRenderer, RenderPromptRequest


def test_prompt_renderer_composes_packaged_sections_with_context():
    prompt = PromptRenderer().render(
        RenderPromptRequest(
            sections=(
                PromptName.BASE_PURPOSE,
                PromptName.BASE_SYNTAX,
                PromptName.OPERATION_GARDEN,
            ),
            context=("Runtime context:\n{}",),
        )
    )

    assert "CodeAlmanac Purpose" in prompt
    assert "Garden Operation" in prompt
    assert "Runtime context:" in prompt
    assert "\n\n---\n\n" in prompt
    assert "public command and product name is `codealmanac`" in prompt
    assert "Page wikilinks must resolve" in prompt
    assert "broken `[[...]]` link" in prompt


def test_prompt_inventory_reads_init_ingest_garden_and_update_operations():
    rendered = {
        name: PromptRenderer().render(RenderPromptRequest(sections=(name,)))
        for name in PromptName
    }

    assert "Init Operation" in rendered[PromptName.OPERATION_INIT]
    assert "first substantial CodeAlmanac wiki" in rendered[PromptName.OPERATION_INIT]
    assert "Ingest Operation" in rendered[PromptName.OPERATION_INGEST]
    assert "Garden Operation" in rendered[PromptName.OPERATION_GARDEN]
    assert "Update Operation" in rendered[PromptName.OPERATION_UPDATE]
    assert "Page Notability And Graph Structure" in rendered[PromptName.BASE_NOTABILITY]


def test_prompt_renderer_requires_sections():
    with pytest.raises(ValidationError):
        RenderPromptRequest(sections=())


def test_prompt_renderer_rejects_blank_context():
    with pytest.raises(ValidationError):
        RenderPromptRequest(
            sections=(PromptName.BASE_PURPOSE,),
            context=(" ",),
        )

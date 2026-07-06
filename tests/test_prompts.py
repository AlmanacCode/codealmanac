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
    assert "public command and product name is `codealmanac`" in prompt
    assert "Use Markdown links for page links" in prompt
    assert "Do not use double-bracket links" in prompt
    assert "File and folder evidence belongs in `sources:`" in prompt
    assert "Run `codealmanac validate`" in prompt
    assert "[[" not in prompt
    assert "pages/" not in prompt
    assert "docs/almanac" not in prompt
    assert ".almanac" not in prompt


def test_prompt_renderer_requires_sections():
    with pytest.raises(ValidationError):
        RenderPromptRequest(sections=())


def test_prompt_renderer_rejects_blank_context():
    with pytest.raises(ValidationError):
        RenderPromptRequest(
            sections=(PromptName.BASE_KERNEL,),
            context=(" ",),
        )

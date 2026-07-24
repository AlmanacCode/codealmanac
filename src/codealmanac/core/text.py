def required_text(value: str, field_name: str) -> str:
    text = value.strip()
    if not text:
        raise ValueError(f"{field_name} must not be empty")
    return text


def optional_text(value: str | None, field_name: str) -> str | None:
    if value is None:
        return None
    return required_text(value, field_name)

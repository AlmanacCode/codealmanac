OPENCODE_MODEL_SEPARATOR = "/"


def split_opencode_model(model: str) -> tuple[str, str]:
    provider_id, separator, model_id = model.partition(OPENCODE_MODEL_SEPARATOR)
    if separator == "" or provider_id == "" or model_id == "":
        raise ValueError(f'opencode model must be "provider/model", got: {model!r}')
    return provider_id, model_id

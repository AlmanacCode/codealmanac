import re


def looks_like_dir(raw: str) -> bool:
    return raw.strip().replace("\\", "/").endswith("/")


def normalize_reference_path(raw: str, is_dir: bool) -> str:
    return normalize_reference_shape(raw, is_dir).casefold()


def normalize_reference_path_preserving_case(raw: str, is_dir: bool) -> str:
    return normalize_reference_shape(raw, is_dir)


def normalize_reference_shape(raw: str, is_dir: bool) -> str:
    text = raw.strip().replace("\\", "/")
    while text.startswith("./"):
        text = text[2:]
    text = re.sub(r"/+", "/", text)
    text = text.lstrip("/")
    if ".." in text.split("/"):
        return ""
    text = text.rstrip("/")
    if is_dir and text:
        return f"{text}/"
    return text


def parent_folder_prefixes(file_path: str) -> list[str]:
    prefixes: list[str] = []
    cursor = 0
    while True:
        index = file_path.find("/", cursor)
        if index == -1:
            return prefixes
        prefixes.append(file_path[: index + 1])
        cursor = index + 1


def escape_glob_meta(input_path: str) -> str:
    return re.sub(r"([*?\[])", r"[\1]", input_path)

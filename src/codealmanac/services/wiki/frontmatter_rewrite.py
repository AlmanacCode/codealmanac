from io import StringIO
from pathlib import Path
from uuid import uuid4

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap, CommentedSeq

from codealmanac.core.errors import ValidationFailed


def rewrite_page_topics(path: Path, topics: tuple[str, ...]) -> None:
    raw = path.read_bytes().decode("utf-8")
    split = split_frontmatter(raw)
    line_ending = "\r\n" if "\r\n" in split.frontmatter else "\n"
    yaml = YAML(typ="rt")
    yaml.preserve_quotes = True
    if split.frontmatter.strip():
        data = yaml.load(split.frontmatter) or CommentedMap()
        if not isinstance(data, CommentedMap):
            raise ValidationFailed(f"frontmatter must be a YAML mapping: {path}")
    else:
        data = CommentedMap()

    apply_topics(data, topics)

    output = StringIO()
    yaml.dump(data, output)
    frontmatter = output.getvalue().rstrip("\n")
    if line_ending != "\n":
        frontmatter = frontmatter.replace("\n", line_ending)
    next_raw = f"---{line_ending}{frontmatter}{line_ending}---{line_ending}"
    next_raw += split.body
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    temporary.write_bytes(next_raw.encode("utf-8"))
    temporary.replace(path)


class FrontmatterSplit:
    def __init__(self, frontmatter: str, body: str):
        self.frontmatter = frontmatter
        self.body = body


def split_frontmatter(raw: str) -> FrontmatterSplit:
    if raw.startswith("---\r\n"):
        return split_with_delimiter(raw, "\r\n")
    if raw.startswith("---\n"):
        return split_with_delimiter(raw, "\n")
    return FrontmatterSplit(frontmatter="", body=raw)


def split_with_delimiter(raw: str, line_ending: str) -> FrontmatterSplit:
    opener = f"---{line_ending}"
    closer = f"{line_ending}---"
    end = raw.find(closer, len(opener))
    if end == -1:
        return FrontmatterSplit(frontmatter="", body=raw)
    frontmatter = raw[len(opener) : end]
    body_start = end + len(closer)
    if raw.startswith(line_ending, body_start):
        body_start += len(line_ending)
    body = raw[body_start:]
    return FrontmatterSplit(frontmatter=frontmatter, body=body)


def apply_topics(data: CommentedMap, topics: tuple[str, ...]) -> None:
    sequence = topic_sequence(data)
    desired = list(topics)
    desired_set = set(desired)
    seen: set[str] = set()
    for index in range(len(sequence) - 1, -1, -1):
        raw_topic = str(sequence[index])
        if raw_topic not in desired_set or raw_topic in seen:
            del sequence[index]
            continue
        sequence[index] = raw_topic
        seen.add(raw_topic)
    for topic in desired:
        if topic not in seen:
            sequence.append(topic)
            seen.add(topic)
    data["topics"] = sequence


def topic_sequence(data: CommentedMap) -> CommentedSeq:
    existing = data.get("topics")
    if isinstance(existing, CommentedSeq):
        return existing
    sequence = CommentedSeq()
    if isinstance(existing, list):
        sequence.extend(str(item) for item in existing)
    return sequence

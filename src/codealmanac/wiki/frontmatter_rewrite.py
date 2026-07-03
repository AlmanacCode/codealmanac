from collections.abc import Callable
from io import StringIO
from pathlib import Path
from uuid import uuid4

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap, CommentedSeq

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.slug import to_kebab_case


class PageTopicsRewrite(CodeAlmanacModel):
    path: Path
    topics: tuple[str, ...]


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


def plan_page_topic_rewrites(
    pages_path: Path,
    transform: Callable[[tuple[str, ...]], tuple[str, ...]],
) -> tuple[PageTopicsRewrite, ...]:
    if not pages_path.is_dir():
        return ()
    rewrites: list[PageTopicsRewrite] = []
    for page_path in sorted(pages_path.rglob("*.md")):
        before = read_page_topics(page_path)
        after = canonical_topic_tuple(transform(before))
        if after != before:
            rewrites.append(PageTopicsRewrite(path=page_path, topics=after))
    return tuple(rewrites)


def apply_page_topic_rewrites(rewrites: tuple[PageTopicsRewrite, ...]) -> int:
    for rewrite in rewrites:
        rewrite_page_topics(rewrite.path, rewrite.topics)
    return len(rewrites)


def read_page_topics(path: Path) -> tuple[str, ...]:
    raw = path.read_bytes().decode("utf-8")
    split = split_frontmatter(raw)
    if not split.frontmatter.strip():
        return ()
    yaml = YAML(typ="rt")
    yaml.preserve_quotes = True
    try:
        data = yaml.load(split.frontmatter) or CommentedMap()
    except Exception as error:
        raise ValidationFailed(f"invalid frontmatter: {path}") from error
    if not isinstance(data, CommentedMap):
        raise ValidationFailed(f"frontmatter must be a YAML mapping: {path}")
    return canonical_topic_tuple(tuple(str(item) for item in topic_sequence(data)))


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


def canonical_topic_tuple(topics: tuple[str, ...]) -> tuple[str, ...]:
    canonical = tuple(to_kebab_case(str(topic)) for topic in topics)
    return tuple(topic for topic in dict.fromkeys(canonical) if topic)

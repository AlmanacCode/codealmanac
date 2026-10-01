import re
from collections.abc import Callable
from io import StringIO
from pathlib import Path
from uuid import uuid4

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap, CommentedSeq

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.slug import to_kebab_case
from codealmanac.services.wiki.paths import iter_page_paths


class PageTopicsRewrite(CodeAlmanacModel):
    path: Path
    topics: tuple[str, ...]


def rewrite_page_topics(path: Path, topics: tuple[str, ...]) -> None:
    raw = path.read_bytes().decode("utf-8")
    split = split_frontmatter(raw)
    line_ending = split.line_ending
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
    almanac_path: Path,
    transform: Callable[[tuple[str, ...]], tuple[str, ...]],
) -> tuple[PageTopicsRewrite, ...]:
    if not almanac_path.is_dir():
        return ()
    rewrites: list[PageTopicsRewrite] = []
    for page_path in iter_page_paths(almanac_path):
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
    def __init__(self, frontmatter: str, body: str, line_ending: str = "\n"):
        self.frontmatter = frontmatter
        self.body = body
        self.line_ending = line_ending


# Same fence rule python-frontmatter uses when the index parses a page, so a
# rewrite always sees the block the index read: three or more dashes, then
# optional trailing whitespace.
FRONTMATTER_FENCE = re.compile(r"-{3,}\s*")


def split_frontmatter(raw: str) -> FrontmatterSplit:
    lines = re.split(r"(?<=\n)", raw)
    if not FRONTMATTER_FENCE.fullmatch(lines[0]):
        return FrontmatterSplit(frontmatter="", body=raw)
    line_ending = "\r\n" if lines[0].endswith("\r\n") else "\n"
    for index in range(1, len(lines)):
        if FRONTMATTER_FENCE.fullmatch(lines[index]):
            return FrontmatterSplit(
                frontmatter="".join(lines[1:index]),
                body="".join(lines[index + 1 :]),
                line_ending=line_ending,
            )
    return FrontmatterSplit(frontmatter="", body=raw)


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

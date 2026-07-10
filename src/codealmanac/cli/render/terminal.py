import shlex
import shutil
import sys


def write_line(line: str) -> None:
    sys.stdout.write(f"{line}\n")


def visible_length(value: str) -> int:
    count = 0
    in_escape = False
    for character in value:
        if character == "\x1b":
            in_escape = True
            continue
        if in_escape:
            if character == "m":
                in_escape = False
            continue
        count += 1
    return count


def terminal_width() -> int:
    return shutil.get_terminal_size((80, 24)).columns


def wrap_with_prefixes(
    text: str,
    first_prefix: str,
    next_prefix: str,
    width: int,
) -> tuple[str, ...]:
    words = tuple(word for word in text.split(" ") if len(word) > 0)
    if len(words) == 0:
        return (first_prefix,)
    lines: list[str] = []
    prefix = first_prefix
    line = prefix
    has_word = False
    for word in words:
        candidate = f"{line} {word}" if has_word else f"{prefix}{word}"
        if has_word and visible_length(candidate) > width:
            lines.append(line)
            prefix = next_prefix
            line = f"{prefix}{word}"
            has_word = True
            continue
        line = candidate
        has_word = True
    lines.append(line)
    return tuple(lines)


def wrap_text(text: str, width: int) -> tuple[str, ...]:
    words = tuple(
        _fit_word(word, width) for word in text.split(" ") if len(word) > 0
    )
    if len(words) == 0:
        return ("",)
    lines: list[str] = []
    line = words[0]
    for word in words[1:]:
        candidate = f"{line} {word}"
        if visible_length(candidate) > width:
            lines.append(line)
            line = word
            continue
        line = candidate
    lines.append(line)
    return tuple(lines)


def _fit_word(word: str, width: int) -> str:
    if visible_length(word) <= width or width <= 1:
        return word
    return f"{word[: width - 1]}…"


def card_row(content: str, width: int, border: str, reset: str) -> str:
    padding = max(0, width - visible_length(content))
    return f"{border}│{reset}{content}{' ' * padding}{border}│{reset}"


def card_right_row(content: str, width: int, border: str, reset: str) -> str:
    padding = max(0, width - visible_length(content) - 2)
    return f"{border}│{reset}{' ' * padding}{content}  {border}│{reset}"


def card_center_row(content: str, width: int, border: str, reset: str) -> str:
    visible = visible_length(content)
    left = max(0, (width - visible) // 2)
    right = max(0, width - visible - left)
    return f"{border}│{reset}{' ' * left}{content}{' ' * right}{border}│{reset}"


def selected_indicator(width: int, style: str, reset: str) -> str:
    text = "◆ selected"
    left_padding = max(0, (width + 2 - len(text)) // 2)
    right_padding = max(0, width + 2 - left_padding - len(text))
    return f"{' ' * left_padding}{style}{text}{reset}{' ' * right_padding}"


def card_width_for(count: int) -> int:
    # A row of cards is: 3 leading spaces, each card is width+2 (borders),
    # plus a 3-space gap between cards. Solving row_width = n*(width+5) for
    # width keeps every option-count screen close to an 80-col terminal.
    row_width = 78
    min_width = 18
    if count <= 0:
        return min_width
    return max(min_width, row_width // count - 5)


def shell_command(command: tuple[str, ...]) -> str:
    return shlex.join(command)

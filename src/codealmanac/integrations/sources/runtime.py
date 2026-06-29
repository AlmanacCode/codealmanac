from codealmanac.integrations.command import CommandResult, first_line


def source_runtime_section(name: str, body: str) -> str:
    if body.strip() == "":
        return f"## {name}\n\n(no output)"
    return f"## {name}\n\n{body.strip()}"


def bounded_text(value: str, max_chars: int) -> tuple[str, bool]:
    if len(value) <= max_chars:
        return value, False
    return value[:max_chars].rstrip() + "\n\n[truncated]", True


def surface_process_error(result: CommandResult) -> str:
    message = first_line(result.stderr, result.stdout)
    if message == "":
        return f"exit {result.returncode}"
    if len(message) > 500:
        return f"{message[:500]}..."
    return message

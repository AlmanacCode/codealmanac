import subprocess


def surface_process_error(result: subprocess.CompletedProcess[str]) -> str:
    text = result.stderr.strip() or result.stdout.strip()
    if len(text) > 500:
        return f"{text[:500]}..."
    return text or f"exit {result.returncode}"

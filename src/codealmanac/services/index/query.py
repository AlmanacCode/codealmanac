import re

SEARCH_TOKEN = re.compile(r"\w+", re.UNICODE)


def analyze_search_query(raw: str) -> str | None:
    """Return an escaped, recall-oriented FTS5 prefix expression."""
    tokens = dict.fromkeys(SEARCH_TOKEN.findall(raw.casefold()))
    if not tokens:
        return None
    return " OR ".join(f'"{token}"*' for token in tokens)


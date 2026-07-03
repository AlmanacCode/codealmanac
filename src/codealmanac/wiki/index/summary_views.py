from codealmanac.database import SQLiteConnection
from codealmanac.wiki.index.models import IndexCounts


def index_counts(connection: SQLiteConnection) -> IndexCounts:
    page_count = connection.execute("SELECT COUNT(*) FROM pages").fetchone()[0]
    topic_count = connection.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    return IndexCounts(pages=page_count, topics=topic_count)

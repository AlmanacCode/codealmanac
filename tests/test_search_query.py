from codealmanac.services.index.query import analyze_search_query


def test_query_terms_are_escaped_prefixed_and_or_joined():
    query = analyze_search_query('How does cancellation "terminate" agent?')

    assert query == (
        '"how"* OR "does"* OR "cancellation"* OR "terminate"* OR "agent"*'
    )


def test_query_analysis_preserves_unicode_identifiers_and_deduplicates():
    query = analyze_search_query("ÜberCache übercache HTTP_404")

    assert query == '"übercache"* OR "http_404"*'


def test_punctuation_only_query_has_no_fts_expression():
    assert analyze_search_query(" -- ?! ") is None


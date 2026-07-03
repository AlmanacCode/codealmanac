---
title: Index Schema Reference
topics: [reference, index, sqlite]
sources:
  - id: schema
    type: file
    path: src/codealmanac/services/index/schema.py
  - id: models
    type: file
    path: src/codealmanac/services/index/models.py
---

# Index Schema Reference

This page lists the derived `index.db` schema and health categories. [[sqlite-index-read-model]] explains refresh and projection.

## Tables

- `pages(slug, title, summary, file_path, content_hash, updated_at, body)` [@schema].
- `topics(slug, title, description)` [@schema].
- `page_topics(page_slug, topic_slug)` [@schema].
- `topic_parents(child_slug, parent_slug)` with `CHECK (child_slug != parent_slug)` [@schema].
- `file_refs(page_slug, path, original_path, is_dir)` with `idx_file_refs_path` [@schema].
- `page_sources(page_slug, source_order, source_id, source_type, target, title, retrieved_at, note)` [@schema].
- `wikilinks(source_slug, target_slug)` and `cross_wiki_links(source_slug, target_wiki, target_slug)` [@schema].
- `fts_pages` FTS5 virtual table and `index_metadata(key, value)` [@schema].

## Health Categories

Health reports can include orphans, dead file refs, broken page links, broken cross-wiki links, empty topics, empty pages, missing source citations, unused sources, and duplicate sources [@models].

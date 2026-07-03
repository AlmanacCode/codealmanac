---
title: Transcript Source Runtime
topics: [architecture, sources, sync]
sources:
  - id: runtime
    type: file
    path: src/codealmanac/integrations/sources/transcripts/runtime.py
  - id: discovery
    type: file
    path: src/codealmanac/integrations/sources/transcripts/__init__.py
  - id: entries
    type: file
    path: src/codealmanac/integrations/sources/transcripts/entries.py
  - id: tests
    type: file
    path: tests/test_transcript_source_runtime.py
---

# Transcript Source Runtime

The transcript runtime lets lifecycle operations ingest local Claude and Codex session material. Discovery adapters scan provider JSONL stores and produce `TranscriptCandidate` rows; runtime inspection reads the requested transcript path and renders a bounded tail of normalized entries [@discovery] [@runtime].

Entry normalization recognizes known provider line shapes and turns them into runtime entries with labels, timestamps, roles, text, and compact JSON when needed [@entries]. The runtime is also the input source used by [[sync-workflow-and-ledger]].

Use [[source-address-syntax-reference]] for `transcript:` syntax and run transcript discovery/runtime tests when changing this area [@tests].

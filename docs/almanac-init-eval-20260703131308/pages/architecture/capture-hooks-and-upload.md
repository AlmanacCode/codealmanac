---
title: Capture Hooks And Upload
topics: [architecture, cloud, capture]
sources:
  - id: service
    type: file
    path: src/codealmanac/services/cloud_capture/service.py
  - id: hooks
    type: file
    path: src/codealmanac/integrations/capture/hooks.py
  - id: transcripts
    type: file
    path: src/codealmanac/integrations/capture/transcripts.py
  - id: events
    type: file
    path: src/codealmanac/services/cloud_capture/event_store.py
---

# Capture Hooks And Upload

Capture hooks connect local Codex/Claude stop-hook payloads to cloud transcript upload. The service reads auth state, capture credentials, hook status, parsed transcript metadata, routing state, and upload outcome into capture status and hook-event results [@service].

The hook integration edits provider config files to add or remove `codealmanac __capture-hook --provider ...` stop hooks [@hooks]. The transcript normalizer extracts transcript path, session/turn metadata, cwd, timestamps, branch routing data, and hashes from provider payloads and JSONL body bytes [@transcripts].

Capture events are stored under the user state root as local JSON artifacts [@events]. This area links cloud support to [[transcript-source-runtime]] but is separate from repo-local `sync`.

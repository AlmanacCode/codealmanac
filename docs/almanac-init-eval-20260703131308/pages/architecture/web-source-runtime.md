---
title: Web Source Runtime
topics: [architecture, sources, integrations]
sources:
  - id: adapter
    type: file
    path: src/codealmanac/integrations/sources/web/adapter.py
  - id: client
    type: file
    path: src/codealmanac/integrations/sources/web/client.py
  - id: documents
    type: file
    path: src/codealmanac/integrations/sources/web/documents.py
  - id: tests
    type: file
    path: tests/test_web_source_runtime.py
---

# Web Source Runtime

The web runtime fetches HTTP(S) source refs and turns web pages or text responses into bounded prompt material. The adapter uses `httpx`, caps response bytes and rendered characters, and reports unsupported content or HTTP failures as unavailable runtime diagnostics [@adapter].

The client streams bounded responses with redirects enabled [@client]. Document parsing classifies content type, decodes UTF-8 text, and uses Beautiful Soup to extract a title and normalized body text from HTML [@documents].

This adapter is part of [[source-resolution-and-runtimes]]. Keep it deterministic and bounded, because source runtimes feed lifecycle prompts directly.

---
page_id: reference-source-addresses
title: Source Addresses
summary: This page lists the source address families resolved before ingest runtime inspection.
topics: [reference, integration]
sources:
  - id: address-resolution
    type: file
    path: src/codealmanac/services/sources/address_resolution.py
  - id: address-path
    type: file
    path: src/codealmanac/services/sources/address_path.py
  - id: address-git
    type: file
    path: src/codealmanac/services/sources/address_git.py
  - id: address-github
    type: file
    path: src/codealmanac/services/sources/address_github.py
  - id: address-transcript
    type: file
    path: src/codealmanac/services/sources/address_transcript.py
  - id: address-web
    type: file
    path: src/codealmanac/services/sources/address_web.py
---

# Source Addresses

Source addresses are raw ingest inputs resolved into structured source references before runtime inspection. The resolver delegates to path, Git, GitHub, transcript, web, number, and hint address helpers. [@address-resolution] [@address-path] [@address-git] [@address-github] [@address-transcript] [@address-web]

## Address families

| Family | Examples |
|---|---|
| Path | Repository files and directories. |
| Git | Commit ranges and diffs. |
| GitHub | Pull requests and issues. |
| Transcript | Local Codex or Claude transcript paths. |
| Web | HTTP or HTTPS URLs. |

## Related pages

Read `[[architecture-source-system]]` and `[[architecture-source-adapters]]`.


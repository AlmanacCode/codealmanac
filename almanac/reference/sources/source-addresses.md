---
title: Source Addresses
topics: [reference, sources, ingest]
sources:
  - id: address-resolution
    type: file
    path: src/codealmanac/services/sources/address_resolution.py
    note: Resolver dispatch order for raw source inputs.
  - id: address-github
    type: file
    path: src/codealmanac/services/sources/address_github.py
    note: GitHub shorthand and GitHub URL parsing.
  - id: address-git
    type: file
    path: src/codealmanac/services/sources/address_git.py
    note: Git range and diff source address parsing.
  - id: address-web
    type: file
    path: src/codealmanac/services/sources/address_web.py
    note: HTTP and HTTPS URL normalization.
  - id: address-transcript
    type: file
    path: src/codealmanac/services/sources/address_transcript.py
    note: Transcript source address parsing.
  - id: address-path
    type: file
    path: src/codealmanac/services/sources/address_path.py
    note: Local file, directory, and missing-path resolution.
  - id: source-models
    type: file
    path: src/codealmanac/services/sources/models.py
    note: Source kind, provenance kind, brief, and ref models.
  - id: sources-tests
    type: file
    path: tests/test_sources_service.py
    note: Contract tests for accepted and rejected source address forms.
---

# Source Addresses

Source addresses are the raw strings accepted by ingest before CodeAlmanac loads source material. Resolution turns each string into a typed `SourceBrief` with a `SourceRef`, title, provenance kind, and prompt hint; runtime adapters load content later from the typed ref [@source-models]. This page lists the accepted forms and the ref shape each one produces.

Address resolution is ordered. CodeAlmanac checks `github:`, `git:range:`, `git:diff`, and `transcript:` prefixes first, then HTTP or HTTPS URLs, then treats anything else as a local path relative to the operation cwd [@address-resolution]. The surrounding flow is described in [Source resolution and runtime](../../architecture/sources/source-resolution-and-runtime), while [Source material](../../concepts/source-material) explains how these inputs differ from page evidence.

## Accepted Forms

| Input form | Resolves to | Important fields |
| --- | --- | --- |
| `github:pr:<number>` | `github.pull_request` | `number`, identity `github.pull_request:<number>` |
| `github:issue:<number>` | `github.issue` | `number`, identity `github.issue:<number>` |
| `https://github.com/<owner>/<repo>/pull/<number>` | `github.pull_request` | `repository`, normalized GitHub URL, `number` |
| `https://github.com/<owner>/<repo>/issues/<number>` | `github.issue` | `repository`, normalized GitHub URL, `number` |
| `http://...` or `https://...` | `web.url` | normalized URL as identity |
| `git:range:<revision-range>` | `git.range` | `revision_range` |
| `git:diff` | `git.diff` | `revision_range` set to `working-tree` |
| `git:diff:<target>` | `git.diff` | `revision_range` set to `<target>` |
| `transcript:<identifier-or-path>` | `transcript` | `transcript` |
| Any other string | `path.file`, `path.directory`, or `path.unknown` | normalized path, existence flag, optional file fingerprint |

GitHub shorthand accepts only `pr` and `issue`, and the number must be a positive integer [@address-github]. GitHub web URLs are recognized only on `github.com` paths shaped like pull requests or issues; other valid HTTP(S) addresses remain ordinary `web.url` refs [@address-github] [@address-web].

## Local Paths

Path addresses are the fallback form. The resolver expands `~`, resolves relative paths against the operation cwd, normalizes the resulting path, and classifies it by filesystem state [@address-path]. Existing files become `path.file` refs and receive a SHA-256 fingerprint when the file can be read. Existing directories become `path.directory` refs. Missing paths become `path.unknown` refs with `exists: false` [@address-path].

Path resolution does not reject missing files. Missing paths are still source refs, with provenance `missing_path`, so the ingest prompt can report that the requested material was unavailable [@source-models] [@address-path].

## Git Addresses

`git:range:<revision-range>` requires non-empty text after the prefix. It produces a `git.range` ref whose identity is `git.range:<revision-range>` [@address-git].

`git:diff` and `git:diff:<target>` both produce `git.diff` refs. The bare form uses `working-tree` as the target; the target form strips the prefix and stores the remaining text as `revision_range` [@address-git]. Runtime loading decides how to inspect the range or diff; resolution only classifies the address.

## URL And Transcript Addresses

HTTP and HTTPS addresses are validated as URLs and normalized before becoming refs. GitHub pull request and issue URLs are upgraded into GitHub refs; all other valid HTTP(S) URLs become `web.url` refs [@address-web] [@address-github].

Transcript addresses use `transcript:<identifier-or-path>`. Empty transcript identifiers are rejected, and valid values become `transcript` refs with identity `transcript:<identifier-or-path>` [@address-transcript].

## Rejection Rules

Malformed GitHub shorthand, non-positive GitHub numbers, empty Git ranges, empty transcript refs, and invalid HTTP(S) URLs raise validation errors [@address-github] [@address-git] [@address-transcript] [@address-web]. Tests cover those rejection cases alongside the accepted local path, GitHub, URL, Git, and transcript forms [@sources-tests].

New source runtime adapters should keep this boundary intact. Add a stable address-to-ref classification first, then load bounded source content behind the adapter path described by [Add a source runtime adapter](../../guides/add-a-source-runtime-adapter).

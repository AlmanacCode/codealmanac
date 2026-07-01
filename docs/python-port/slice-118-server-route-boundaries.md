# Slice 118: Server Route Boundaries

## Scope

Keep `codealmanac serve` behavior unchanged while splitting the FastAPI server
adapter by responsibility.

## Out of scope

- No viewer UI change.
- No new server endpoint.
- No change to multi-wiki selection.
- No change to static package assets.
- No hosted or remote viewer surface.

## Design

Cosmic Python chapter 13 names the bootstrap/composition-root role: one place
should assemble dependencies and entrypoints. `server/app.py` should be that
composition root for the local viewer server, not the owner of route bodies,
asset validation, package-resource reads, and error mapping.

Target shape:

```python
server = FastAPI(title="CodeAlmanac Local Viewer")
register_error_handlers(server)
register_api_routes(server, ServerApiContext(codealmanac=app, cwd=cwd, scope_wiki=wiki))
register_static_routes(server)
```

`api_routes.py` owns HTTP-to-viewer-service request construction.
`static_routes.py` owns static route registration.
`static_assets.py` owns package asset validation and reading.
`errors.py` owns product/Pydantic exception to HTTP JSON mapping.

## Verification

- Focused server behavior tests.
- Architecture guard keeping route decorators, asset loading, request models,
  and error mapping out of `server/app.py`.
- Live `serve` HTTP dogfood after the split.

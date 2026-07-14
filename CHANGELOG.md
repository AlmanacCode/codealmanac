# Changelog

## 0.4.0 - 2026-07-10

### Changed

- Configuration now lives only at `~/.codealmanac/config.toml`.
  Repository-level `almanac/config.toml` is no longer read.
- Sync, Garden, and Update enabled states and intervals are user config keys.
  `codealmanac config set` applies automation changes immediately, while
  `codealmanac config apply` applies direct TOML edits.
- `codealmanac automation install` and `automation uninstall` were removed.
  Use `config set automation.<task>.*`; `automation status` remains available.

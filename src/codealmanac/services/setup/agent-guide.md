# codealmanac

This machine uses codealmanac, a local wiki for codebases. When a repository has
an `almanac/` directory, read it before changing a real subsystem.

Useful commands:

```bash
codealmanac search "auth"
codealmanac search --mentions src/auth/
codealmanac show auth-flow
codealmanac topics
codealmanac health
codealmanac validate
```

The wiki is local repository knowledge. Code is still the source of truth when
code and wiki disagree.

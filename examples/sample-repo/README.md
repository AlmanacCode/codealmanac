# Sample Repo

This tiny repo shows what an Almanac wiki looks like after a few useful engineering sessions.

Try it from this directory:

```bash
npx codealmanac search "checkout"
npx codealmanac search --mentions src/checkout.ts
npx codealmanac show checkout-flow
npx codealmanac topics list
```

The important files are under `.almanac/`:

- `.almanac/README.md` defines the notability bar for the wiki.
- `.almanac/pages/checkout-flow.md` captures a cross-file flow.
- `.almanac/pages/payment-provider-timeouts.md` captures a gotcha.
- `.almanac/topics.yaml` organizes the pages.

There is no generated `index.db` checked in. Almanac rebuilds the local index when you query the wiki.

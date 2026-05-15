---
title: Payment Provider Timeouts
summary: "A provider timeout means checkout is pending; it does not prove the charge failed."
topics: [gotchas, payments]
files:
  - src/checkout.ts
  - src/payments.ts
---

# Payment Provider Timeouts

The payment provider can time out after accepting an authorization request. When that happens, checkout must return `pending` and schedule a retry instead of telling the user that payment failed.

This matters because a retry may discover that the provider already created a receipt. Treating timeout as failure can double-charge the user if a later retry starts a second authorization.

Agents editing [[src/checkout.ts]] should preserve the `pending` state unless they also change the reconciliation model.

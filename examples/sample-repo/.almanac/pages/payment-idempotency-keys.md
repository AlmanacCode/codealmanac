---
title: Payment Idempotency Keys
summary: "Always pass an idempotency key when calling the payment provider to safely retry authorizations."
topics: [gotchas, payments]
files:
  - src/payments.ts
---

# Payment Idempotency Keys

When retrying an authorization request with the payment provider, it is critical to use an idempotency key. This ensures that the payment provider will not charge the customer twice if the first request succeeded but we timed out while waiting for the response.

Agents editing [[src/payments.ts]] should ensure that any calls to the provider include an idempotency key generated at the beginning of the checkout session.

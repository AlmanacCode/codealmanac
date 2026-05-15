---
title: Checkout Flow
summary: "Checkout starts from a cart id, waits for payment authorization, and treats provider timeouts as pending rather than failed."
topics: [flows, payments]
files:
  - src/checkout.ts
  - src/payments.ts
---

# Checkout Flow

Checkout begins in [[src/checkout.ts]] with a cart id. The caller expects a durable status rather than a raw provider response, so the flow returns either `paid` with a receipt id or `pending` with a retry delay.

Payment authorization lives in [[src/payments.ts]]. Future edits should keep the checkout boundary responsible for user-facing state and the payment boundary responsible for provider communication.

Timeouts are not failed checkouts. See [[payment-provider-timeouts]] before changing retry behavior.

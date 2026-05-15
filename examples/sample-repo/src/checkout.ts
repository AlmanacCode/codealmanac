type CheckoutResult =
  | { status: "paid"; receiptId: string }
  | { status: "pending"; retryAfterSeconds: number };

export async function startCheckout(cartId: string): Promise<CheckoutResult> {
  if (!cartId) {
    throw new Error("cartId is required");
  }

  return {
    status: "pending",
    retryAfterSeconds: 30,
  };
}

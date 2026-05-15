export async function authorizePayment(amountCents: number): Promise<string> {
  if (amountCents <= 0) {
    throw new Error("amountCents must be positive");
  }

  return "receipt_sample";
}

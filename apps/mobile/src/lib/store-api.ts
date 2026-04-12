export type CreateRazorpayOrderResponse = {
  razorpayOrderId: string;
  keyId: string;
  amountPaise: number;
  currency: string;
  amountInr: number;
  paymentMode: "test" | "live";
};

function trimBase(url: string) {
  return url.replace(/\/$/, "");
}

export function getWebsiteBaseUrl(): string | null {
  const u = process.env.EXPO_PUBLIC_WEBSITE_URL?.trim();
  return u ? trimBase(u) : null;
}

export async function createStoreRazorpayOrder(
  baseUrl: string,
  accessToken: string,
  items: { product_id: string; quantity: number }[],
): Promise<CreateRazorpayOrderResponse> {
  const res = await fetch(`${baseUrl}/api/store/razorpay/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ items }),
  });
  const data = (await res.json()) as { error?: string } & Partial<CreateRazorpayOrderResponse>;
  if (!res.ok) {
    throw new Error(data.error ?? "Could not start payment.");
  }
  if (!data.razorpayOrderId || !data.keyId || data.amountPaise == null) {
    throw new Error("Invalid response from payment server.");
  }
  return {
    razorpayOrderId: data.razorpayOrderId,
    keyId: data.keyId,
    amountPaise: data.amountPaise,
    currency: data.currency ?? "INR",
    amountInr: data.amountInr ?? data.amountPaise / 100,
    paymentMode: data.paymentMode ?? "test",
  };
}

export async function confirmStoreCheckout(
  baseUrl: string,
  accessToken: string,
  payload: {
    items: { product_id: string; quantity: number }[];
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    shippingAddress: {
      line1: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone: string;
    };
  },
): Promise<{ orderId?: string }> {
  const res = await fetch(`${baseUrl}/api/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      items: payload.items,
      razorpayOrderId: payload.razorpayOrderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      razorpaySignature: payload.razorpaySignature,
      shippingAddress: payload.shippingAddress,
      paymentProvider: "razorpay",
    }),
  });
  const data = (await res.json()) as { error?: string; orderId?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Checkout failed.");
  }
  return data;
}

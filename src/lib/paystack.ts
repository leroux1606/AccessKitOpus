/**
 * PayStack API Integration
 * Documentation: https://paystack.com/docs/api/
 */

import crypto from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PaystackCustomer {
  id: number;
  customer_code: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface PaystackSubscription {
  id: number;
  subscription_code: string;
  customer: PaystackCustomer;
  plan: {
    id: number;
    plan_code: string;
    name: string;
    amount: number;
    interval: string;
  };
  status: string;
  next_payment_date: string;
  created_at: string;
}

interface PaystackTransaction {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string;
  customer: PaystackCustomer;
}

/**
 * Make authenticated request to PayStack API
 */
async function paystackRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<PaystackResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error as { message?: string }).message || `PayStack API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`PayStack API timed out after 15s (${endpoint})`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Initialize a transaction (redirects user to PayStack hosted page)
 */
export async function initializeTransaction(params: {
  email: string;
  amount: number; // in kobo/cents — overridden by plan amount when plan is set
  plan?: string;  // PayStack plan code
  callback_url?: string;
  metadata?: Record<string, unknown>;
}) {
  const response = await paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(params),
  });

  return response.data;
}

/**
 * Verify a transaction by reference
 */
export async function verifyTransaction(reference: string) {
  const response = await paystackRequest<PaystackTransaction>(
    `/transaction/verify/${reference}`
  );
  return response.data;
}

/**
 * Create a new customer
 */
export async function createCustomer(params: {
  email: string;
  first_name?: string;
  last_name?: string;
  metadata?: Record<string, unknown>;
}) {
  const response = await paystackRequest<PaystackCustomer>("/customer", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return response.data;
}

/**
 * Get customer by email or customer code
 */
export async function getCustomer(emailOrCode: string) {
  const response = await paystackRequest<PaystackCustomer>(
    `/customer/${emailOrCode}`
  );
  return response.data;
}

/**
 * Get subscription details
 */
export async function getSubscription(idOrCode: string) {
  const response = await paystackRequest<PaystackSubscription>(
    `/subscription/${idOrCode}`
  );
  return response.data;
}

/**
 * Generate a subscription self-service management link
 */
export async function generateSubscriptionLink(subscriptionCode: string) {
  const response = await paystackRequest<{ link: string }>(
    `/subscription/${subscriptionCode}/manage/link`
  );
  return response.data;
}

/**
 * Disable (cancel) a subscription
 */
export async function disableSubscription(params: {
  code: string;
  token: string;
}) {
  const response = await paystackRequest<{ status: string }>("/subscription/disable", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return response.data;
}

/**
 * Verify webhook signature using HMAC-SHA512
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!PAYSTACK_SECRET_KEY) return false;
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    // timingSafeEqual throws if buffers differ in length (malformed signature)
    return false;
  }
}
